/** Catalogue des Outils et des Stades, branché sur les points d'accroche du calcul. */
import type { CardData, CardIndex, CardInstance, PokemonType } from '../engine/cards.ts';
import { POKEMON_TYPES } from '../engine/cards.ts';
import type { ComboId } from '../engine/combos.ts';
import type { OpponentKind } from '../engine/state.ts';
import { PRICE_MULT_CAP, RARITY_PRICE_FALLBACK, type ToolRarity } from './balance.ts';

export const TOOL_IDS = [
  'campfire',
  'picnic',
  'lightBag',
  'colossus',
  'counterType',
  'prism',
  'familyTree',
  'rigidBinder',
  'pokedex',
  'training',
  'favoriteArtist',
  'bigBench',
  'marketValue',
  'piggyBank',
  'nap',
  'duo',
  'evolutionStone',
  'heavyweight',
  'palette',
  'badgeCase',
  // Phase 3
  'whetstone',
  'megaphone',
  'lastStand',
  'smallTeam',
  'fullTeam',
  'featherweight',
  'trio',
  'goldNugget',
  'coupon',
  'backpack',
  'colorChart',
  'monochrome',
  'heritage',
  'reverseSleeve',
  'battery',
  'talentShow',
  'analysis',
  'armorPiercer',
  'savings',
  'loyaltyCard',
  'leanDeck',
  'grandSlam',
  'rivalry',
  'finisher',
  'growthCharm',
  'comboBook',
  'runningShoes',
  'rookie',
  'hourglass',
  'goldMedal',
  // Stades
  'trainingGround',
  'marketSquare',
  'lineagePalace',
  'typeTemple',
  'rainbowBridge',
  'dojo',
  'greenhouse',
  'sanctuary',
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export interface ToolInstance {
  uid: number;
  toolId: ToolId;
  /** Type du Feu de camp ; `null` pour les autres Outils. */
  type: PokemonType | null;
  /** Prix payé, pour la revente. */
  price: number;
  /** Compteur permanent (Entraînement : Lignées jouées ; Collier : combats gagnés). */
  stacks: number;
}

/** Cartes vues par un Outil au moment où il se déclenche. */
export interface ToolContext {
  tool: ToolInstance;
  index: CardIndex;
  combo: ComboId;
  played: readonly { instance: CardInstance; data: CardData; types: readonly PokemonType[] }[];
  scoring: readonly { instance: CardInstance; data: CardData }[];
  /** Une carte jouée touche la faiblesse de l'adversaire. */
  hitsWeakness: boolean;
  /** Colorless compte comme tout type (Prisme actif). */
  colorlessWild: boolean;
  /** Variantes neutralisées par un effet de boss. */
  variantsOff: boolean;
  /** Pokémon différents joués pendant la run, main en cours comprise. */
  distinctPokemon: number;
  /** ₽ détenus au moment de jouer. */
  money: number;
  /** Points de Retraite restants au moment de jouer. */
  retreatPoints: number;
  /** Combats gagnés pendant la run, combat en cours exclu. */
  fightsWon: number;
  /** Tour en cours et nombre de Tours du combat. */
  turn: number;
  maxTurns: number;
  /** Cartes du deck. */
  deckSize: number;
  opponentKind: OpponentKind;
  /** Part des PV de l'adversaire restante avant cette main, de 0 à 1. */
  opponentHpRatio: number;
  /** Mains déjà jouées de cette combinaison pendant la run, main en cours exclue. */
  comboCount: number;
}

export interface ToolDef {
  id: ToolId;
  rarity: ToolRarity;
  /** Un seul Stade à la fois : le nouveau remplace l'ancien. */
  stadium?: boolean;
  /** Neutralisé par Charme. */
  collection?: boolean;
  /** Neutralisé par l'effet permanent Incolore. */
  typeBound?: boolean;
  /** Neutralisé par Écailles renforcé. */
  weakness?: boolean;
  /** +Multi de l'Outil pour cette main. */
  addMult?: (context: ToolContext) => number;
  /** ×Multi de l'Outil pour cette main. */
  timesMult?: (context: ToolContext) => number;
  /** +Dégâts de l'Outil pour cette main. */
  addDamage?: (context: ToolContext) => number;
  /** Les cartes comptent leurs PV au lieu de leurs dégâts. */
  countsHp?: boolean;
  /** Les cartes Incolore comptent comme n'importe quel type. */
  colorlessWildcard?: boolean;
  /** Une carte rejoue ses dégâts si sa pré-évolution est jouée. */
  replaysEvolution?: boolean;
  /** Multiplicateur de faiblesse à la place de ×2. */
  weaknessTimes?: number;
  /** Nombre maximum de cartes posées. */
  maxPlayed?: number;
  /** ₽ par Tour non utilisé en fin de combat. */
  moneyPerUnusedTurn?: number;
  /** ₽ pour chaque carte à retraite 0 défaussée. */
  moneyPerFreeDiscard?: number;
  /** Compteur gagné à chaque main selon sa combinaison. */
  stacksGained?: (combo: ComboId) => number;
  /** Compteur gagné à chaque combat remporté. */
  stacksPerWin?: number;
  /** Tours et points de Retraite en plus à chaque combat. */
  extraTurns?: number;
  extraRetreat?: number;
  /** Cartes en plus dans la main. */
  handBonus?: number;
  /** ₽ à chaque combat gagné. */
  moneyPerWin?: number;
  /** Plafond des intérêts relevé d'autant. */
  interestCapBonus?: number;
  /** ₽ retirés du prix des relances et des boosters. */
  rerollDiscount?: number;
  boosterDiscount?: number;
  /** La résistance de l'adversaire ne s'applique pas. */
  ignoresResistance?: boolean;
  /** Un statut qui a réussi son jet échoue une fois sur deux. */
  statusWard?: boolean;
}

const TRAINING_STEP = 0.1;
const CAMPFIRE_MULT = 4;
const RIGID_BINDER_TIMES = 1.5;
const FAVORITE_ARTIST_TIMES = 2;
const PIGGY_BANK_STEP = 5;
const NAP_MULT = 2;
const DUO_MULT = 6;
const EVOLUTION_STONE_MULT = 3;
const HEAVYWEIGHT_MULT = 4;
const HEAVYWEIGHT_RETREAT = 3;
const PALETTE_TIMES = 2;
const BADGE_CASE_STEP = 0.1;
const WHETSTONE_DAMAGE = 40;
const MEGAPHONE_MULT = 4;
const LAST_STAND_MULT = 10;
const SMALL_TEAM_MULT = 10;
const SMALL_TEAM_SIZE = 3;
const FULL_TEAM_MULT = 6;
const FULL_TEAM_SIZE = 5;
const FEATHERWEIGHT_MULT = 3;
const FEATHERWEIGHT_RETREAT = 1;
const TRIO_MULT = 10;
const COLOR_CHART_MULT = 3;
const MONOCHROME_TIMES = 2;
const HERITAGE_TIMES = 2;
const REVERSE_SLEEVE_DAMAGE = 30;
const BATTERY_MULT = 2;
const TALENT_SHOW_MULT = 3;
const ANALYSIS_MULT = 10;
const LEAN_DECK_MULT = 2;
const LEAN_DECK_SIZE = 20;
const GRAND_SLAM_TIMES = 3;
const RIVALRY_TIMES = 1.5;
const FINISHER_TIMES = 2;
const FINISHER_RATIO = 0.25;
const ROOKIE_MULT = 2;
const GOLD_MEDAL_TIMES = 2;
const STADIUM_COMBO_TIMES = 3;
const DOJO_TIMES = 4;

export function isLineCombo(combo: ComboId): boolean {
  return combo === 'line' || combo === 'monoLine';
}

function marketMult(card: CardData): number {
  const price = card.cardmarketPrice ?? RARITY_PRICE_FALLBACK[card.rarity];
  return Math.min(PRICE_MULT_CAP, Math.floor(price));
}

export const TOOLS: Record<ToolId, ToolDef> = {
  campfire: {
    id: 'campfire',
    rarity: 'common',
    typeBound: true,
    addMult: ({ tool, played, colorlessWild }) =>
      CAMPFIRE_MULT *
      played.filter(
        ({ types }) =>
          (tool.type !== null && types.includes(tool.type)) ||
          (colorlessWild && types.includes('Colorless')),
      ).length,
  },
  picnic: { id: 'picnic', rarity: 'common', moneyPerUnusedTurn: 2 },
  lightBag: { id: 'lightBag', rarity: 'common', moneyPerFreeDiscard: 1 },
  colossus: { id: 'colossus', rarity: 'uncommon', countsHp: true },
  counterType: { id: 'counterType', rarity: 'uncommon', weakness: true, weaknessTimes: 3 },
  prism: { id: 'prism', rarity: 'uncommon', typeBound: true, colorlessWildcard: true },
  familyTree: { id: 'familyTree', rarity: 'rare', replaysEvolution: true },
  rigidBinder: {
    id: 'rigidBinder',
    rarity: 'rare',
    collection: true,
    timesMult: ({ played, variantsOff }) => {
      const holo = played.filter(({ instance }) => instance.variant === 'holo').length;
      return variantsOff ? 1 : RIGID_BINDER_TIMES ** holo;
    },
  },
  pokedex: {
    id: 'pokedex',
    rarity: 'rare',
    addMult: ({ distinctPokemon }) => distinctPokemon,
  },
  training: {
    id: 'training',
    rarity: 'rare',
    stacksGained: (combo) => (isLineCombo(combo) ? 1 : 0),
    timesMult: ({ tool, combo }) =>
      1 + TRAINING_STEP * (tool.stacks + (isLineCombo(combo) ? 1 : 0)),
  },
  favoriteArtist: {
    id: 'favoriteArtist',
    rarity: 'rare',
    timesMult: ({ played }) => {
      const artists = new Set(played.map(({ data }) => data.illustrator));
      return artists.size === 1 && !artists.has(null) ? FAVORITE_ARTIST_TIMES : 1;
    },
  },
  bigBench: { id: 'bigBench', rarity: 'rare', maxPlayed: 6 },
  marketValue: {
    id: 'marketValue',
    rarity: 'legendary',
    collection: true,
    addMult: ({ scoring }) => scoring.reduce((sum, { data }) => sum + marketMult(data), 0),
  },
  piggyBank: {
    id: 'piggyBank',
    rarity: 'common',
    addMult: ({ money }) => Math.floor(money / PIGGY_BANK_STEP),
  },
  nap: {
    id: 'nap',
    rarity: 'common',
    addMult: ({ retreatPoints }) => NAP_MULT * retreatPoints,
  },
  duo: {
    id: 'duo',
    rarity: 'common',
    addMult: ({ combo }) => (combo === 'pair' || combo === 'family' ? DUO_MULT : 0),
  },
  evolutionStone: {
    id: 'evolutionStone',
    rarity: 'common',
    addMult: ({ played }) =>
      EVOLUTION_STONE_MULT * played.filter(({ data }) => data.stage !== 'Basic').length,
  },
  heavyweight: {
    id: 'heavyweight',
    rarity: 'uncommon',
    addMult: ({ played }) =>
      HEAVYWEIGHT_MULT * played.filter(({ data }) => data.retreat >= HEAVYWEIGHT_RETREAT).length,
  },
  palette: {
    id: 'palette',
    rarity: 'uncommon',
    timesMult: ({ combo }) => (combo === 'rainbow' ? PALETTE_TIMES : 1),
  },
  badgeCase: {
    id: 'badgeCase',
    rarity: 'rare',
    timesMult: ({ fightsWon }) => 1 + BADGE_CASE_STEP * fightsWon,
  },
  whetstone: { id: 'whetstone', rarity: 'common', addDamage: () => WHETSTONE_DAMAGE },
  megaphone: { id: 'megaphone', rarity: 'common', addMult: () => MEGAPHONE_MULT },
  lastStand: {
    id: 'lastStand',
    rarity: 'common',
    addMult: ({ turn, maxTurns }) => (turn >= maxTurns ? LAST_STAND_MULT : 0),
  },
  smallTeam: {
    id: 'smallTeam',
    rarity: 'common',
    addMult: ({ played }) => (played.length <= SMALL_TEAM_SIZE ? SMALL_TEAM_MULT : 0),
  },
  fullTeam: {
    id: 'fullTeam',
    rarity: 'common',
    addMult: ({ played }) => (played.length >= FULL_TEAM_SIZE ? FULL_TEAM_MULT : 0),
  },
  featherweight: {
    id: 'featherweight',
    rarity: 'common',
    addMult: ({ played }) =>
      FEATHERWEIGHT_MULT *
      played.filter(({ data }) => data.retreat <= FEATHERWEIGHT_RETREAT).length,
  },
  trio: {
    id: 'trio',
    rarity: 'common',
    addMult: ({ combo }) => (combo === 'triple' || combo === 'family' ? TRIO_MULT : 0),
  },
  goldNugget: { id: 'goldNugget', rarity: 'common', moneyPerWin: 2 },
  coupon: { id: 'coupon', rarity: 'common', rerollDiscount: 2 },
  backpack: { id: 'backpack', rarity: 'common', extraRetreat: 1 },
  colorChart: {
    id: 'colorChart',
    rarity: 'uncommon',
    addMult: ({ played }) => COLOR_CHART_MULT * new Set(played.flatMap(({ types }) => types)).size,
  },
  monochrome: {
    id: 'monochrome',
    rarity: 'uncommon',
    timesMult: ({ combo }) => (combo === 'monotype' ? MONOCHROME_TIMES : 1),
  },
  heritage: {
    id: 'heritage',
    rarity: 'uncommon',
    timesMult: ({ combo }) => (isLineCombo(combo) ? HERITAGE_TIMES : 1),
  },
  reverseSleeve: {
    id: 'reverseSleeve',
    rarity: 'uncommon',
    collection: true,
    addDamage: ({ played, variantsOff }) =>
      variantsOff
        ? 0
        : REVERSE_SLEEVE_DAMAGE *
          played.filter(({ instance }) => instance.variant === 'reverse').length,
  },
  battery: {
    id: 'battery',
    rarity: 'uncommon',
    addMult: ({ played }) =>
      BATTERY_MULT *
      played.reduce(
        (sum, { instance }) => sum + instance.energies.length + (instance.specials?.length ?? 0),
        0,
      ),
  },
  talentShow: {
    id: 'talentShow',
    rarity: 'uncommon',
    addMult: ({ played }) =>
      TALENT_SHOW_MULT * played.filter(({ data }) => data.abilityFamily !== null).length,
  },
  analysis: {
    id: 'analysis',
    rarity: 'uncommon',
    weakness: true,
    addMult: ({ hitsWeakness }) => (hitsWeakness ? ANALYSIS_MULT : 0),
  },
  armorPiercer: { id: 'armorPiercer', rarity: 'uncommon', ignoresResistance: true },
  savings: { id: 'savings', rarity: 'uncommon', interestCapBonus: 5 },
  loyaltyCard: { id: 'loyaltyCard', rarity: 'uncommon', boosterDiscount: 1 },
  leanDeck: {
    id: 'leanDeck',
    rarity: 'uncommon',
    addMult: ({ deckSize }) => LEAN_DECK_MULT * Math.max(0, LEAN_DECK_SIZE - deckSize),
  },
  grandSlam: {
    id: 'grandSlam',
    rarity: 'rare',
    timesMult: ({ combo }) => (combo === 'quad' || combo === 'quint' ? GRAND_SLAM_TIMES : 1),
  },
  rivalry: {
    id: 'rivalry',
    rarity: 'rare',
    timesMult: ({ opponentKind }) =>
      opponentKind === 'champion' || opponentKind === 'league' ? RIVALRY_TIMES : 1,
  },
  finisher: {
    id: 'finisher',
    rarity: 'rare',
    timesMult: ({ opponentHpRatio }) => (opponentHpRatio < FINISHER_RATIO ? FINISHER_TIMES : 1),
  },
  growthCharm: {
    id: 'growthCharm',
    rarity: 'rare',
    stacksPerWin: 1,
    addMult: ({ tool }) => tool.stacks,
  },
  comboBook: {
    id: 'comboBook',
    rarity: 'rare',
    addMult: ({ comboCount }) => comboCount,
  },
  runningShoes: { id: 'runningShoes', rarity: 'rare', handBonus: 1 },
  rookie: {
    id: 'rookie',
    rarity: 'common',
    addMult: ({ played }) =>
      ROOKIE_MULT * played.filter(({ data }) => data.stage === 'Basic').length,
  },
  hourglass: { id: 'hourglass', rarity: 'legendary', extraTurns: 1 },
  goldMedal: { id: 'goldMedal', rarity: 'legendary', timesMult: () => GOLD_MEDAL_TIMES },
  trainingGround: { id: 'trainingGround', rarity: 'uncommon', stadium: true, extraRetreat: 2 },
  marketSquare: {
    id: 'marketSquare',
    rarity: 'uncommon',
    stadium: true,
    rerollDiscount: 2,
    boosterDiscount: 2,
  },
  lineagePalace: {
    id: 'lineagePalace',
    rarity: 'rare',
    stadium: true,
    timesMult: ({ combo }) => (isLineCombo(combo) ? STADIUM_COMBO_TIMES : 1),
  },
  typeTemple: {
    id: 'typeTemple',
    rarity: 'rare',
    stadium: true,
    timesMult: ({ combo }) => (combo === 'monotype' ? STADIUM_COMBO_TIMES : 1),
  },
  rainbowBridge: {
    id: 'rainbowBridge',
    rarity: 'rare',
    stadium: true,
    timesMult: ({ combo }) => (combo === 'rainbow' ? STADIUM_COMBO_TIMES : 1),
  },
  dojo: {
    id: 'dojo',
    rarity: 'rare',
    stadium: true,
    timesMult: ({ played }) => (played.length === 1 ? DOJO_TIMES : 1),
  },
  greenhouse: { id: 'greenhouse', rarity: 'rare', stadium: true, handBonus: 2 },
  sanctuary: { id: 'sanctuary', rarity: 'uncommon', stadium: true, statusWard: true },
};

/** Tout ce que la boutique peut proposer : un Feu de camp par type, puis les autres Outils. */
export const TOOL_OFFERS: readonly { toolId: ToolId; type: PokemonType | null }[] = [
  ...POKEMON_TYPES.map((type) => ({ toolId: 'campfire' as const, type })),
  ...TOOL_IDS.filter((id) => id !== 'campfire').map((toolId) => ({ toolId, type: null })),
];
