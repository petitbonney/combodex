/** Catalogue initial des Outils, branché sur les points d'accroche du calcul. */
import type { CardData, CardIndex, CardInstance, PokemonType } from '../engine/cards.ts';
import { POKEMON_TYPES } from '../engine/cards.ts';
import type { ComboId } from '../engine/combos.ts';
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
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export interface ToolInstance {
  uid: number;
  toolId: ToolId;
  /** Type du Feu de camp ; `null` pour les autres Outils. */
  type: PokemonType | null;
  /** Prix payé, pour la revente. */
  price: number;
  /** Compteur permanent (Entraînement : nombre de Lignées jouées). */
  stacks: number;
}

/** Cartes vues par un Outil au moment où il se déclenche. */
export interface ToolContext {
  tool: ToolInstance;
  index: CardIndex;
  combo: ComboId;
  played: readonly { instance: CardInstance; data: CardData; types: readonly PokemonType[] }[];
  scoring: readonly { instance: CardInstance; data: CardData }[];
  /** Colorless compte comme tout type (Prisme actif). */
  colorlessWild: boolean;
  /** Variantes neutralisées par un effet de boss. */
  variantsOff: boolean;
  /** Pokémon différents joués pendant la run, main en cours comprise. */
  distinctPokemon: number;
}

export interface ToolDef {
  id: ToolId;
  rarity: ToolRarity;
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
}

const TRAINING_STEP = 0.1;
const CAMPFIRE_MULT = 4;
const RIGID_BINDER_TIMES = 1.5;
const FAVORITE_ARTIST_TIMES = 2;

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
};

/** Tout ce que la boutique peut proposer : un Feu de camp par type, puis les autres Outils. */
export const TOOL_OFFERS: readonly { toolId: ToolId; type: PokemonType | null }[] = [
  ...POKEMON_TYPES.map((type) => ({ toolId: 'campfire' as const, type })),
  ...TOOL_IDS.filter((id) => id !== 'campfire').map((toolId) => ({ toolId, type: null })),
];
