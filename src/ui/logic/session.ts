/**
 * Une partie côté interface : applique les actions au moteur, sauvegarde, puis joue la timeline.
 * Aucune règle ici ; une action est légale si `applyAction` l'accepte.
 */
import { type Readable, writable } from 'svelte/store';
import type { Language, Messages } from '../../content/i18n/index.ts';
import {
  type Action,
  applyAction,
  type CardIndex,
  createRun,
  type GameEvent,
  IllegalActionError,
  type IllegalReason,
  type RunOptions,
  type RunState,
} from '../../engine/index.ts';
import { decodeSave, encodeSave, type SaveStore } from './save.ts';
import { advanceStage, EMPTY_STAGE, type Stage } from './stage.ts';
import { BEAT_MS, type Beat, buildTimeline } from './timeline.ts';

export interface SessionView {
  state: RunState | null;
  stage: Stage;
  /** Une animation est en cours : les actions du joueur attendent. */
  busy: boolean;
  /** Vrai si une écriture de sauvegarde a échoué. */
  saveFailed: boolean;
}

/** Tout ce qu'il faut pour lancer une run. */
export type RunStart = RunOptions & { setId: string };

export interface SessionOptions {
  /** Index de l'extension d'une run. */
  indexFor: (setId: string) => CardIndex;
  store: SaveStore;
  /** Multiplicateur de vitesse des animations. */
  speed: () => number;
  texts: () => { language: Language; text: Messages };
  now?: () => number;
  /** Prévenu quand un nouvel état s'affiche, pour précharger la main. */
  onCommit?: (state: RunState) => void;
  /** Prévenu de chaque nouvel état, pour la progression entre les runs. */
  onProgress?: (state: RunState, events: readonly GameEvent[], index: CardIndex) => void;
}

export class Session implements Readable<SessionView> {
  readonly #options: SessionOptions;
  readonly #view = writable<SessionView>({
    state: null,
    stage: EMPTY_STAGE,
    busy: false,
    saveFailed: false,
  });
  #current: SessionView = { state: null, stage: EMPTY_STAGE, busy: false, saveFailed: false };
  /** Les écritures s'enchaînent : la dernière action est toujours la dernière écrite. */
  #saving: Promise<void> = Promise.resolve();
  #wake: (() => void) | null = null;
  #skipping = false;

  constructor(options: SessionOptions) {
    this.#options = options;
  }

  subscribe: Readable<SessionView>['subscribe'] = (run, invalidate) =>
    this.#view.subscribe(run, invalidate);

  get state(): RunState | null {
    return this.#current.state;
  }

  #publish(change: Partial<SessionView>): void {
    this.#current = { ...this.#current, ...change };
    this.#view.set(this.#current);
  }

  #commit(state: RunState | null, stage: Stage): void {
    this.#publish({ state, stage });
    if (state) this.#options.onCommit?.(state);
  }

  #persist(state: RunState): Promise<void> {
    const { store, now = Date.now } = this.#options;
    const over = state.phase === 'won' || state.phase === 'lost';
    this.#saving = this.#saving
      .then(() => (over ? store.clear() : store.write(encodeSave(state, now()))))
      .then(() => {
        if (this.#current.saveFailed) this.#publish({ saveFailed: false });
      })
      .catch(() => this.#publish({ saveFailed: true }));
    return this.#saving;
  }

  /** Attend la fin des écritures en cours. */
  flush(): Promise<void> {
    return this.#saving;
  }

  async savedRun(): Promise<RunState | null> {
    try {
      return decodeSave(await this.#options.store.read(), this.#options.indexFor);
    } catch {
      return null;
    }
  }

  resume(state: RunState): void {
    this.#commit(state, EMPTY_STAGE);
  }

  newRun({ setId, ...options }: RunStart): void {
    const index = this.#options.indexFor(setId);
    const state = createRun(index, options);
    this.#commit(state, EMPTY_STAGE);
    this.#options.onProgress?.(state, [], index);
    void this.#persist(state);
  }

  /** Quitte la run en cours sans l'effacer, pour revenir à l'accueil. */
  leave(): void {
    this.#commit(null, EMPTY_STAGE);
  }

  async abandon(): Promise<void> {
    this.#commit(null, EMPTY_STAGE);
    await this.#saving;
    await this.#options.store.clear();
  }

  /** Raison pour laquelle le moteur refuserait cette action, sans rien changer. */
  refusal(action: Action): IllegalReason | null {
    const { state } = this.#current;
    if (!state) return 'runOver';
    try {
      applyAction(state, action, this.#options.indexFor(state.setId));
      return null;
    } catch (error) {
      if (error instanceof IllegalActionError) return error.reason;
      throw error;
    }
  }

  /** Applique l'action et joue ses animations ; rend la raison d'un refus. */
  async dispatch(action: Action): Promise<IllegalReason | null> {
    const { state, busy } = this.#current;
    if (!state || busy) return null;
    const { indexFor, texts } = this.#options;
    const index = indexFor(state.setId);
    let result: ReturnType<typeof applyAction>;
    try {
      result = applyAction(state, action, index);
    } catch (error) {
      if (error instanceof IllegalActionError) return error.reason;
      throw error;
    }
    const { state: next, events } = result;
    this.#options.onProgress?.(next, events, index);
    void this.#persist(next);
    const timeline = buildTimeline({
      before: state,
      after: next,
      action,
      events,
      index,
      ...texts(),
    });
    if (timeline.before.length === 0 && timeline.after.length === 0) {
      this.#commit(next, EMPTY_STAGE);
      return null;
    }
    this.#skipping = false;
    this.#publish({ busy: true });
    await this.#play(timeline.before);
    this.#commit(next, EMPTY_STAGE);
    await this.#play(timeline.after);
    this.#publish({ stage: EMPTY_STAGE, busy: false });
    return null;
  }

  async #play(beats: readonly Beat[]): Promise<void> {
    let stage = EMPTY_STAGE;
    for (const beat of beats) {
      stage = advanceStage(stage, beat);
      this.#publish({ stage });
      if (beat.kind === 'gains') await this.#pause(null);
      else if (!this.#skipping) await this.#pause(BEAT_MS[beat.kind] / this.#options.speed());
    }
  }

  /** Attend la durée donnée, ou indéfiniment avec `null` : seul `skip` réveille alors. */
  #pause(duration: number | null): Promise<void> {
    return new Promise((resolve) => {
      const timer = duration === null ? null : setTimeout(() => this.#resume(), duration);
      this.#wake = () => {
        if (timer !== null) clearTimeout(timer);
        resolve();
      };
    });
  }

  #resume(): void {
    const wake = this.#wake;
    this.#wake = null;
    wake?.();
  }

  /** Passe l'animation en cours ; un écran de gains attend ce même appel pour se fermer. */
  skip(): void {
    const gate = this.#current.stage.beat?.kind === 'gains';
    if (!gate) this.#skipping = true;
    this.#resume();
  }
}
