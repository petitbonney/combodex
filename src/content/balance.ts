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
export const ARENA_HP = [2000, 4000, 9000, 18000, 35000, 65000, 120000, 200000] as const;
/** PV du Maître de la Ligue. */
export const LEAGUE_HP = 400000;
/** Part des PV du Champion pour le Dresseur et le Dresseur d'élite. */
export const TRAINER_HP_RATIO = 0.5;
export const ELITE_HP_RATIO = 0.75;
/** Les statuts renforcés commencent à l'Arène 5 (indice 4). */
export const STRONG_STATUS_ARENA_INDEX = 4;
/** Une run complète : 8 Arènes, puis la Ligue. */
export const DEFAULT_ARENA_COUNT = 8;
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
export const WIN_MONEY = { trainer: 3, elite: 4, champion: 5, league: 5 } as const;
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
export const TRAINER_BOOSTER_PRICE = 6;
export const TRAINER_BOOSTER_SIZE = 3;
export const PREMIUM_BOOSTER_PRICE = 8;
export const PREMIUM_BOOSTER_SIZE = 5;
/** Cartes gardées dans un booster Premium ; 1 pour les autres. */
export const PREMIUM_BOOSTER_KEEPS = 2;
/** Boosters proposés dans une boutique, tous différents. */
export const SHOP_BOOSTERS = 2;
export const BOOSTER_WEIGHTS = { set: 40, energy: 30, trainer: 20, premium: 10 } as const;
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

// Consommables
/** Le dernier emplacement de la boutique : poids de chaque sorte de consommable. */
export const CONSUMABLE_WEIGHTS = { energy: 40, special: 30, leap: 15, ace: 15 } as const;
export const CONSUMABLE_PRICES = { energy: 2, special: 4, leap: 5, ace: 7 } as const;
/** ACE SPEC : gain maximal du Gros lot. */
export const JACKPOT_CAP = 20;
/** ACE SPEC : Tours et points de Retraite rendus par Second souffle. */
export const SECOND_WIND_TURNS = 2;
export const SECOND_WIND_RETREAT = 2;
/** ACE SPEC : cartes détruites par le Grand ménage. */
export const CLEANUP_CARDS = 3;

// Énergies spéciales
export const DOUBLE_ENERGY_DAMAGE = 30;
export const FORCE_ENERGY_MULT = 4;
export const ECHO_ENERGY_TIMES = 1.25;
export const FORTUNE_ENERGY_MONEY = 1;

// Centre Pokémon
/** Sous cette taille, le deck ne perd plus de carte : une main doit rester possible. */
export const MIN_DECK_SIZE = 8;

// Deck de départ
export const STARTER_LINES = 2;
export const STARTER_BASICS = 10;
