/** Progression gardée entre les runs : chargée au lancement, écrite à chaque changement. */
import { type Readable, writable } from 'svelte/store';
import type { ObjectiveId } from '../../content/objectives.ts';
import {
  type CardIndex,
  emptyMeta,
  type GameEvent,
  type MetaState,
  observeRun,
  type RunState,
} from '../../engine/index.ts';
import { decodeMeta, type MetaStore } from './save.ts';

export interface ProgressOptions {
  store: MetaStore;
  /** Prévenu de chaque objectif atteint. */
  onReached?: (id: ObjectiveId) => void;
}

export class Progress implements Readable<MetaState> {
  readonly #options: ProgressOptions;
  readonly #view = writable<MetaState>(emptyMeta());
  #current: MetaState = emptyMeta();
  /** Les écritures s'enchaînent : la dernière progression est la dernière écrite. */
  #saving: Promise<void> = Promise.resolve();

  constructor(options: ProgressOptions) {
    this.#options = options;
  }

  subscribe: Readable<MetaState>['subscribe'] = (run, invalidate) =>
    this.#view.subscribe(run, invalidate);

  get current(): MetaState {
    return this.#current;
  }

  async load(): Promise<void> {
    try {
      this.#current = decodeMeta(await this.#options.store.read());
    } catch {
      this.#current = emptyMeta();
    }
    this.#view.set(this.#current);
  }

  observe(state: RunState, events: readonly GameEvent[], index: CardIndex): void {
    const { meta, reached } = observeRun(this.#current, state, events, index);
    this.#current = meta;
    this.#view.set(meta);
    for (const id of reached) this.#options.onReached?.(id);
    this.#saving = this.#saving.then(() => this.#options.store.write(meta)).catch(() => undefined);
  }

  /** Attend la fin des écritures en cours. */
  flush(): Promise<void> {
    return this.#saving;
  }
}
