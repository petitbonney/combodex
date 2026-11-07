/** Méta-progression : ce que le joueur garde entre les runs. Pur et sans stockage. */
import {
  LOCKABLE_TOOLS,
  OBJECTIVE_IDS,
  OBJECTIVES,
  type ObjectiveId,
  type Records,
  SPECIALIST_RATIO,
} from '../content/objectives.ts';
import { CUSTOM_DECK_RATIO, SETS, STARTING_SET } from '../content/sets.ts';
import type { ToolId } from '../content/tools.ts';
import { type CardIndex, cardOf, POKEMON_TYPES } from './cards.ts';
import { seedFromText } from './rng.ts';
import type { GameEvent, RunState } from './state.ts';

export interface MetaState {
  /** Cartes vues ou gagnées, par extension. */
  seen: Record<string, string[]>;
  records: Records;
  /** Objectifs atteints, dans l'ordre. */
  objectives: ObjectiveId[];
  /** Meilleure main de chaque défi du jour, par date. */
  daily: Record<string, number>;
}

export function emptyMeta(): MetaState {
  return {
    seen: {},
    records: {
      runsWon: 0,
      handsPlayed: 0,
      bestHand: 0,
      mostChampions: 0,
      mostMoney: 0,
      specialistWin: false,
      combos: {},
    },
    objectives: [],
    daily: {},
  };
}

/** Cartes que le joueur a sous les yeux dans cet état. */
function visibleCardIds(state: RunState): string[] {
  const ids = state.deck.map((card) => card.cardId);
  for (const slot of state.shop?.slots ?? []) {
    if (slot?.kind === 'card') ids.push(slot.cardId);
  }
  for (const card of state.booster?.cards ?? []) ids.push(card.cardId);
  if (state.fight) ids.push(state.fight.opponent.cardId);
  for (const arena of state.arenas) ids.push(arena.championCardId);
  return ids;
}

function withSeen(meta: MetaState, state: RunState): MetaState {
  const known = new Set(meta.seen[state.setId] ?? []);
  const before = known.size;
  for (const id of visibleCardIds(state)) known.add(id);
  if (known.size === before) return meta;
  return { ...meta, seen: { ...meta.seen, [state.setId]: [...known] } };
}

/** Vrai si assez de cartes du deck partagent un même type. */
export function isSpecialistDeck(state: RunState, index: CardIndex): boolean {
  const needed = state.deck.length * SPECIALIST_RATIO;
  return POKEMON_TYPES.some(
    (type) =>
      state.deck.filter((card) => cardOf(index, card).types.includes(type)).length >= needed,
  );
}

function updatedRecords(
  records: Records,
  state: RunState,
  events: readonly GameEvent[],
  index: CardIndex,
): Records {
  const next: Records = {
    ...records,
    combos: { ...records.combos },
    mostChampions: Math.max(records.mostChampions, state.stats.championsBeaten),
    mostMoney: Math.max(records.mostMoney, state.money),
  };
  for (const event of events) {
    if (event.type === 'handPlayed') {
      const { combo, score } = event.result;
      next.handsPlayed += 1;
      next.bestHand = Math.max(next.bestHand, score);
      next.combos[combo] = (next.combos[combo] ?? 0) + 1;
    }
    if (event.type === 'runWon') {
      next.runsWon += 1;
      next.specialistWin = next.specialistWin || isSpecialistDeck(state, index);
    }
  }
  return next;
}

export interface MetaUpdate {
  meta: MetaState;
  /** Objectifs atteints par cette action. */
  reached: ObjectiveId[];
}

/** Met à jour la progression après une action de la run. */
export function observeRun(
  meta: MetaState,
  state: RunState,
  events: readonly GameEvent[],
  index: CardIndex,
): MetaUpdate {
  const seen = withSeen(meta, state);
  const records = updatedRecords(seen.records, state, events, index);
  const reached = OBJECTIVE_IDS.filter(
    (id) => !seen.objectives.includes(id) && OBJECTIVES[id].reached(records),
  );
  const { dailyDate } = state;
  const daily =
    dailyDate && state.stats.bestHand > (seen.daily[dailyDate] ?? -1)
      ? { ...seen.daily, [dailyDate]: state.stats.bestHand }
      : seen.daily;
  return {
    meta: { ...seen, records, daily, objectives: [...seen.objectives, ...reached] },
    reached,
  };
}

/** Une extension s'ouvre par objectif ; la première l'est d'office. */
export function isSetUnlocked(meta: MetaState, setId: string): boolean {
  if (setId === STARTING_SET) return true;
  return meta.objectives.some((id) => {
    const { reward } = OBJECTIVES[id];
    return reward.kind === 'set' && reward.setId === setId;
  });
}

export function unlockedSets(meta: MetaState): string[] {
  return SETS.map((set) => set.id).filter((id) => isSetUnlocked(meta, id));
}

/** L'objectif qui ouvre cette extension, s'il y en a un. */
export function objectiveOfSet(setId: string): ObjectiveId | null {
  const found = OBJECTIVE_IDS.find((id) => {
    const { reward } = OBJECTIVES[id];
    return reward.kind === 'set' && reward.setId === setId;
  });
  return found ?? null;
}

/** Outils qu'une nouvelle run ne doit pas proposer. */
export function lockedTools(meta: MetaState): ToolId[] {
  const earned = new Set(
    meta.objectives.flatMap((id) => {
      const { reward } = OBJECTIVES[id];
      return reward.kind === 'tool' ? [reward.toolId] : [];
    }),
  );
  return LOCKABLE_TOOLS.filter((tool) => !earned.has(tool));
}

export interface Completion {
  seen: number;
  total: number;
  ratio: number;
}

export function completion(meta: MetaState, index: CardIndex): Completion {
  const total = index.set.cards.length;
  const seen = (meta.seen[index.set.id] ?? []).length;
  return { seen, total, ratio: total === 0 ? 0 : seen / total };
}

/** Le deck custom s'ouvre à 25 % d'une extension. */
export function isCustomDeckUnlocked(meta: MetaState, index: CardIndex): boolean {
  return completion(meta, index).ratio >= CUSTOM_DECK_RATIO;
}

export interface DailyChallenge {
  date: string;
  setId: string;
  seed: number;
}

/** Même défi pour tous à une date donnée : la graine et l'extension ne dépendent que d'elle. */
export function dailyChallenge(date: string): DailyChallenge {
  const days = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const set = SETS[days % SETS.length] ?? SETS[0];
  if (!set) throw new Error('Aucune extension');
  return { date, setId: set.id, seed: seedFromText(`combodex-${date}`) };
}

/** Date du défi : le jour UTC, pour que tous les joueurs aient le même. */
export function dailyDate(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}
