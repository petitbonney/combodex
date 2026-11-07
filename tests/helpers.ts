/** Fabriques de cartes et d'états pour tester les règles sur des cas précis. */
import type { ToolId, ToolInstance } from '../src/content/tools.ts';
import type {
  CardData,
  CardIndex,
  CardInstance,
  CardSet,
  PokemonType,
  Variant,
} from '../src/engine/cards.ts';
import { indexCards } from '../src/engine/cards.ts';
import type { ComboCard } from '../src/engine/combos.ts';
import { createRng } from '../src/engine/rng.ts';
import { defaultRules, type HandRules } from '../src/engine/rules.ts';
import type { ScoreInput } from '../src/engine/scoring.ts';
import type { FightState, Opponent, RunState } from '../src/engine/state.ts';

let nextDex = 1;

export function card(overrides: Partial<CardData> & { id: string }): CardData {
  const name = overrides.name?.en ?? overrides.id;
  return {
    localId: overrides.id,
    name: { fr: name, en: name },
    dexIds: [nextDex++],
    types: ['Fire'],
    stage: 'Basic',
    evolveFrom: null,
    hp: 100,
    retreat: 1,
    bestDamage: 50,
    weaknesses: [],
    resistances: [],
    rarity: 'Common',
    variants: ['normal', 'reverse', 'holo'],
    illustrator: 'Artist',
    abilityFamily: null,
    ability: null,
    isTagTeam: false,
    cardmarketId: null,
    cardmarketPrice: null,
    ...overrides,
  };
}

export function comboCard(data: CardData, extra: Partial<ComboCard> = {}): ComboCard {
  return { data, types: data.types, wildcard: false, strength: data.bestDamage, ...extra };
}

export function indexOf(cards: CardData[]): CardIndex {
  const set: CardSet = {
    id: 'test',
    name: { fr: 'Test', en: 'Test' },
    sourceCommit: 'test',
    cards,
  };
  return indexCards(set);
}

export function instance(
  uid: number,
  data: CardData,
  variant: Variant = 'normal',
  energies: PokemonType[] = [],
): CardInstance {
  return { uid, cardId: data.id, variant, energies };
}

export function tool(uid: number, toolId: ToolId, type: PokemonType | null = null): ToolInstance {
  return { uid, toolId, type, price: 4, stacks: 0 };
}

/** Une entrée de calcul où chaque carte posée reçoit un uid à partir de 1. */
export function scoreInput(
  played: (CardData | CardInstance)[],
  cards: CardData[],
  overrides: Partial<Omit<ScoreInput, 'rules'>> & { rules?: Partial<HandRules> } = {},
): ScoreInput {
  const { rules, ...rest } = overrides;
  return {
    index: indexOf(cards),
    played: played.map((entry, position) =>
      'uid' in entry ? entry : instance(position + 1, entry),
    ),
    hand: [],
    opponent: { maxHp: 1000, weaknesses: [], resistances: [] },
    tools: [],
    disabledToolUids: [],
    rules: { ...defaultRules(), ...rules },
    comboCounts: {},
    seenDexIds: [],
    money: 0,
    retreatPoints: 4,
    fightsWon: 0,
    rng: null,
    ...rest,
  };
}

export function opponent(overrides: Partial<Opponent> = {}): Opponent {
  return {
    kind: 'champion',
    cardId: 'boss',
    type: 'Grass',
    maxHp: 1000,
    hp: 1000,
    weaknesses: [],
    resistances: [],
    form: null,
    ...overrides,
  };
}

interface RunSetup {
  /** Cartes du deck ; leur uid est leur position. */
  deck: CardData[];
  hand?: number[];
  drawPile?: number[];
  tools?: ToolInstance[];
  fight?: Partial<FightState>;
  run?: Partial<RunState>;
}

/** Un combat en cours, au premier Tour, avec une main choisie. */
export function fightRun(setup: RunSetup): RunState {
  const deck = setup.deck.map((data, uid) => instance(uid, data));
  const hand = setup.hand ?? deck.map((entry) => entry.uid).slice(0, 8);
  const drawPile =
    setup.drawPile ?? deck.map((entry) => entry.uid).filter((uid) => !hand.includes(uid));
  const fight: FightState = {
    opponent: opponent(),
    drawPile,
    hand,
    discardPile: [],
    turn: 1,
    maxTurns: 4,
    retreatPoints: 4,
    announcedStatus: null,
    activeStatus: null,
    poisonPercent: 0,
    afflicted: false,
    extraDraw: 0,
    pendingSearches: 0,
    searchChoices: null,
    swappedUids: [],
    faceDownUids: [],
    hypnotizedUids: [],
    paralyzedUids: [],
    forcedUids: [],
    turnDisabledToolUids: [],
    fightDisabledToolUids: [],
    ...setup.fight,
  };
  return {
    seed: 1,
    rng: createRng(1),
    phase: 'fight',
    arenas: [{ type: 'Grass', form: 'statuses', championCardId: 'boss' }],
    arenaIndex: 0,
    stageIndex: 0,
    deck,
    tools: setup.tools ?? [],
    money: 0,
    stats: { comboCounts: {}, seenDexIds: [], bestHand: 0, handsPlayed: 0, fightsWon: 0 },
    arenaBanishedUids: [],
    arenaEvolutionUsed: false,
    nextUid: deck.length,
    fight,
    shop: null,
    booster: null,
    ...setup.run,
  };
}

/** Cartes simples, numérotées, sans lien entre elles. */
export function fillers(count: number, overrides: Partial<CardData> = {}): CardData[] {
  return Array.from({ length: count }, (_, position) =>
    card({ id: `filler-${nextDex}-${position}`, ...overrides }),
  );
}
