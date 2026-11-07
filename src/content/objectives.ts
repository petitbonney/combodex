/**
 * Objectifs de la méta-progression : ils ouvrent des extensions et des Outils, jamais de puissance
 * brute. Un objectif caché n'affiche sa condition qu'une fois atteint.
 */
import type { ComboId } from '../engine/combos.ts';
import type { ToolId } from './tools.ts';

export const OBJECTIVE_IDS = [
  'fourChampions',
  'monoLineHand',
  'winRun',
  'specialistWin',
  'playQuint',
  'hugeHand',
  'manyHands',
  'allChampions',
  'richPlayer',
] as const;
export type ObjectiveId = (typeof OBJECTIVE_IDS)[number];

export type ObjectiveReward = { kind: 'set'; setId: string } | { kind: 'tool'; toolId: ToolId };

/** Records cumulés sur toutes les runs. */
export interface Records {
  runsWon: number;
  handsPlayed: number;
  bestHand: number;
  /** Le plus de Champions vaincus en une seule run. */
  mostChampions: number;
  /** Le plus de ₽ détenus d'un coup. */
  mostMoney: number;
  /** Une run gagnée avec un deck de spécialiste. */
  specialistWin: boolean;
  combos: Partial<Record<ComboId, number>>;
}

export interface ObjectiveDef {
  id: ObjectiveId;
  hidden: boolean;
  reward: ObjectiveReward;
  reached: (records: Records) => boolean;
}

const HUGE_HAND = 100000;
const MANY_HANDS = 200;
const RICH_MONEY = 40;
const FOUR_CHAMPIONS = 4;
const ALL_CHAMPIONS = 8;

/** Part du deck qui doit partager un type pour une victoire de spécialiste. */
export const SPECIALIST_RATIO = 2 / 3;

export const OBJECTIVES: Record<ObjectiveId, ObjectiveDef> = {
  fourChampions: {
    id: 'fourChampions',
    hidden: false,
    reward: { kind: 'set', setId: 'sm1' },
    reached: ({ mostChampions }) => mostChampions >= FOUR_CHAMPIONS,
  },
  monoLineHand: {
    id: 'monoLineHand',
    hidden: true,
    reward: { kind: 'set', setId: 'sm2' },
    reached: ({ combos }) => (combos.monoLine ?? 0) > 0,
  },
  winRun: {
    id: 'winRun',
    hidden: false,
    reward: { kind: 'tool', toolId: 'hourglass' },
    reached: ({ runsWon }) => runsWon > 0,
  },
  specialistWin: {
    id: 'specialistWin',
    hidden: false,
    reward: { kind: 'tool', toolId: 'goldMedal' },
    reached: ({ specialistWin }) => specialistWin,
  },
  playQuint: {
    id: 'playQuint',
    hidden: true,
    reward: { kind: 'tool', toolId: 'grandSlam' },
    reached: ({ combos }) => (combos.quint ?? 0) > 0,
  },
  hugeHand: {
    id: 'hugeHand',
    hidden: false,
    reward: { kind: 'tool', toolId: 'dojo' },
    reached: ({ bestHand }) => bestHand >= HUGE_HAND,
  },
  manyHands: {
    id: 'manyHands',
    hidden: false,
    reward: { kind: 'tool', toolId: 'comboBook' },
    reached: ({ handsPlayed }) => handsPlayed >= MANY_HANDS,
  },
  allChampions: {
    id: 'allChampions',
    hidden: false,
    reward: { kind: 'tool', toolId: 'runningShoes' },
    reached: ({ mostChampions }) => mostChampions >= ALL_CHAMPIONS,
  },
  richPlayer: {
    id: 'richPlayer',
    hidden: true,
    reward: { kind: 'tool', toolId: 'growthCharm' },
    reached: ({ mostMoney }) => mostMoney >= RICH_MONEY,
  },
};

/** Outils qu'une run ne propose pas tant que leur objectif n'est pas atteint. */
export const LOCKABLE_TOOLS: readonly ToolId[] = OBJECTIVE_IDS.flatMap((id) => {
  const { reward } = OBJECTIVES[id];
  return reward.kind === 'tool' ? [reward.toolId] : [];
});
