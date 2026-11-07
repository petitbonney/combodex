/**
 * Estimation de la force d'un jeu d'Outils : le bot tire quelques mains de son deck, garde les
 * meilleures poses et les recalcule avec chaque jeu d'Outils. Il ne touche pas au générateur de la run.
 */
import { MAX_PLAYED, MAX_TURNS, RETREAT_POINTS } from '../content/balance.ts';
import { TOOLS, type ToolId, type ToolInstance } from '../content/tools.ts';
import {
  type CardIndex,
  type CardInstance,
  createRng,
  defaultRules,
  type RunState,
  sample,
  scoreHand,
} from '../engine/index.ts';

const SAMPLED_HANDS = 5;
const KEPT_SELECTIONS = 4;
const HAND = 8;

/** Bonus estimés pour les Outils qui ne passent pas par le calcul d'une main. */
const INDIRECT_VALUE: Partial<Record<ToolId, number>> = {
  hourglass: 0.3,
  runningShoes: 0.15,
  greenhouse: 0.25,
  bigBench: 0.05,
  backpack: 0.05,
  trainingGround: 0.08,
  sanctuary: 0.08,
  armorPiercer: 0.03,
  counterType: 0.15,
  goldNugget: 0.06,
  picnic: 0.05,
  savings: 0.05,
  coupon: 0.01,
  loyaltyCard: 0.03,
  marketSquare: 0.05,
  lightBag: 0.01,
};

/** Part du bonus indirect d'économie qui reste en fin de run. */
const LATE_ARENA = 5;
const ECONOMY: readonly ToolId[] = ['goldNugget', 'picnic', 'savings', 'coupon', 'loyaltyCard'];

interface Selection {
  played: CardInstance[];
  rest: CardInstance[];
}

export interface Sample {
  hands: Selection[][];
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  const results: T[][] = [];
  const walk = (start: number, current: T[]) => {
    if (current.length > 0) results.push(current);
    if (current.length === size) return;
    for (let i = start; i < items.length; i++) walk(i + 1, [...current, items[i] as T]);
  };
  walk(0, []);
  return results;
}

function score(
  state: RunState,
  index: CardIndex,
  selection: Selection,
  tools: readonly ToolInstance[],
): number {
  return scoreHand({
    index,
    played: selection.played,
    hand: selection.rest,
    opponent: { kind: 'champion', maxHp: 1, weaknesses: [], resistances: [] },
    tools,
    disabledToolUids: [],
    rules: defaultRules(),
    comboCounts: state.stats.comboCounts,
    seenDexIds: state.stats.seenDexIds,
    money: state.money,
    retreatPoints: RETREAT_POINTS / 2,
    fightsWon: state.stats.fightsWon,
    turn: 2,
    maxTurns: MAX_TURNS,
    deckSize: state.deck.length,
    rng: null,
  }).score;
}

/** Tire des mains et garde leurs meilleures poses avec les Outils actuels. */
export function sampleDeck(state: RunState, index: CardIndex): Sample {
  const rng = createRng(state.rng.state ^ 0x5bd1e995);
  const hands: Selection[][] = [];
  for (let i = 0; i < SAMPLED_HANDS; i++) {
    const cards = sample(rng, state.deck, HAND);
    const ranked = combinations(cards, MAX_PLAYED).map((played) => {
      const selection = { played, rest: cards.filter((card) => !played.includes(card)) };
      return { selection, value: score(state, index, selection, []) };
    });
    ranked.sort((a, b) => b.value - a.value);
    hands.push(ranked.slice(0, KEPT_SELECTIONS).map(({ selection }) => selection));
  }
  return { hands };
}

/** Score moyen de la meilleure pose, avec ce jeu d'Outils. */
export function toolsetValue(
  state: RunState,
  index: CardIndex,
  deck: Sample,
  tools: readonly ToolInstance[],
): number {
  const indirect = tools.reduce((sum, tool) => {
    const economy = ECONOMY.includes(tool.toolId) && state.arenaIndex >= LATE_ARENA;
    return sum + (economy ? 0 : (INDIRECT_VALUE[tool.toolId] ?? 0));
  }, 0);
  const total = deck.hands.reduce(
    (sum, selections) =>
      sum + Math.max(...selections.map((selection) => score(state, index, selection, tools))),
    0,
  );
  return (total / deck.hands.length) * (1 + indirect);
}

/** Un Outil imaginaire, pour l'estimer avant de l'acheter. */
export function trialTool(offer: { toolId: ToolId; type: ToolInstance['type'] }): ToolInstance {
  return { uid: -1, ...offer, price: 0, stacks: 0 };
}

export function isStadium(toolId: ToolId): boolean {
  return TOOLS[toolId].stadium === true;
}
