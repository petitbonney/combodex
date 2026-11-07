/**
 * Valeurs d'équilibrage. Toute valeur changée ici est reportée dans docs/game-design.md.
 */
import type { Rarity, Variant } from '../engine/cards.ts';

export const HAND_SIZE = 8;
export const MAX_PLAYED = 5;
export const MAX_TURNS = 4;
export const RETREAT_POINTS = 4;
export const TOOL_SLOTS = 5;
export const MAX_TAG_TEAMS = 2;

/** PV du Champion par Arène. */
export const ARENA_HP = [2000, 4000, 7000, 10000, 22000, 40000, 70000, 100000] as const;
/** Part des PV du Champion pour le Dresseur et le Dresseur d'élite. */
export const TRAINER_HP_RATIO = 0.5;
export const ELITE_HP_RATIO = 0.75;
/** Les statuts renforcés commencent à l'Arène 5 (indice 4). */
export const STRONG_STATUS_ARENA_INDEX = 4;
/** Prototype : run courte. */
export const DEFAULT_ARENA_COUNT = 3;
/** Le Champion est tiré parmi les N plus gros PV de son type. */
export const CHAMPION_POOL_SIZE = 3;

// Scoring
export const REVERSE_DAMAGE = 30;
export const HOLO_MULT = 10;
export const FIRST_EDITION_TIMES = 1.5;
export const ENERGY_DAMAGE = 10;
export const WEAKNESS_TIMES = 2;
export const RESISTANCE_DAMAGE = 30;

// Talents
export const COUNTERS_PERCENT = 0.02;
export const AFFLICTION_PERCENT = 0.03;
export const POWER_DAMAGE = 20;
export const REWARD_MONEY = 2;
export const GENERIC_MULT = 2;
export const COIN_FLIP_TIMES = 2;
export const SCOUT_DEPTH = 3;
export const SEARCH_DEPTH = 3;

// Effets permanents
export const PLANT_HEAL_PERCENT = 0.1;
export const ELECTRIC_TURNS = 3;
export const FIGHTING_MAX_SCORING = 3;
export const METAL_COMBO_FACTOR = 0.5;
/** Chance qu'une carte soit tirée face cachée sous l'effet permanent Psy. */
export const PSYCHIC_FACE_DOWN_CHANCE = 0.5;

// Économie
export const WIN_MONEY = { trainer: 3, elite: 4, champion: 5 } as const;
export const UNUSED_TURN_MONEY = 1;
export const INTEREST_STEP = 5;
export const INTEREST_CAP = 5;

// Boutique
export const SHOP_SLOTS = 2;
export const REROLL_BASE_COST = 5;
export const SET_BOOSTER_PRICE = 4;
export const SET_BOOSTER_SIZE = 5;
export const ENERGY_BOOSTER_PRICE = 4;
export const ENERGY_BOOSTER_SIZE = 3;
/** Chance qu'un emplacement de boutique propose un Outil plutôt qu'une carte. */
export const SHOP_TOOL_CHANCE = 0.5;

export const CARD_PRICES: Record<Rarity, number> = {
  Common: 2,
  Uncommon: 3,
  Rare: 5,
  'Ultra Rare': 8,
  'Secret Rare': 8,
};

/** Poids de tirage. Ultra rare : environ 1 booster de 5 cartes sur 10. */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  Common: 60,
  Uncommon: 28,
  Rare: 10,
  'Ultra Rare': 1.4,
  'Secret Rare': 0.6,
};

export const VARIANT_WEIGHTS: Record<Variant, number> = {
  normal: 75,
  reverse: 18,
  holo: 6,
  firstEdition: 1,
};

export type ToolRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export const TOOL_PRICES: Record<ToolRarity, number> = {
  common: 4,
  uncommon: 5,
  rare: 7,
  legendary: 10,
};

export const TOOL_RARITY_WEIGHTS: Record<ToolRarity, number> = {
  common: 55,
  uncommon: 30,
  rare: 13,
  legendary: 2,
};

/** Multi de La Cote quand le prix Cardmarket manque. */
export const RARITY_PRICE_FALLBACK: Record<Rarity, number> = {
  Common: 0,
  Uncommon: 0,
  Rare: 1,
  'Ultra Rare': 10,
  'Secret Rare': 20,
};
export const PRICE_MULT_CAP = 50;

// Deck de départ
export const STARTER_LINES = 2;
export const STARTER_BASICS = 10;
