/** Modèle des cartes : données figées au build et instances possédées par le joueur. */

export const POKEMON_TYPES = [
  'Grass',
  'Fire',
  'Water',
  'Lightning',
  'Psychic',
  'Fighting',
  'Darkness',
  'Metal',
  'Fairy',
  'Dragon',
  'Colorless',
] as const;
export type PokemonType = (typeof POKEMON_TYPES)[number];

export type Variant = 'normal' | 'reverse' | 'holo' | 'firstEdition';
export type Stage = 'Basic' | 'Stage1' | 'Stage2';
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Ultra Rare' | 'Secret Rare';

export const ABILITY_FAMILIES = [
  'copy',
  'versatile',
  'evolution',
  'recovery',
  'counters',
  'affliction',
  'shield',
  'heal',
  'energy',
  'search',
  'scout',
  'draw',
  'switch',
  'agility',
  'power',
  'reward',
  'discard',
  'bench',
  'coinFlip',
  'generic',
] as const;
export type AbilityFamily = (typeof ABILITY_FAMILIES)[number];

export interface LocalizedText {
  fr: string;
  en: string;
}

/** Une carte telle que produite par `scripts/build-data.ts`. */
export interface CardData {
  id: string;
  localId: string;
  name: LocalizedText;
  dexIds: number[];
  types: PokemonType[];
  stage: Stage;
  /** Nom anglais de la pré-évolution, qui sert de clé de lignée. */
  evolveFrom: string | null;
  hp: number;
  retreat: number;
  bestDamage: number;
  weaknesses: PokemonType[];
  resistances: PokemonType[];
  rarity: Rarity;
  variants: Variant[];
  illustrator: string | null;
  abilityFamily: AbilityFamily | null;
  ability: { name: LocalizedText; effect: LocalizedText } | null;
  isTagTeam: boolean;
  cardmarketId: number | null;
  /** Prix Cardmarket en euros, relevé au build ; repli sur la rareté s'il manque. */
  cardmarketPrice: number | null;
}

export interface CardSet {
  id: string;
  name: LocalizedText;
  sourceCommit: string;
  cards: CardData[];
}

/** Une carte possédée : elle garde ses énergies et sa variante quand elle évolue. */
export interface CardInstance {
  uid: number;
  cardId: string;
  variant: Variant;
  energies: PokemonType[];
}

export interface CardIndex {
  set: CardSet;
  byId: ReadonlyMap<string, CardData>;
  byEnglishName: ReadonlyMap<string, CardData[]>;
}

export function indexCards(set: CardSet): CardIndex {
  const byId = new Map(set.cards.map((card) => [card.id, card]));
  const byEnglishName = new Map<string, CardData[]>();
  for (const card of set.cards) {
    const sameName = byEnglishName.get(card.name.en);
    if (sameName) sameName.push(card);
    else byEnglishName.set(card.name.en, [card]);
  }
  return { set, byId, byEnglishName };
}

export function cardOf(index: CardIndex, instance: CardInstance): CardData {
  const card = index.byId.get(instance.cardId);
  if (!card) throw new Error(`Carte inconnue : ${instance.cardId}`);
  return card;
}

/** Vrai si `child` évolue directement de `parent`. */
export function evolvesFrom(child: CardData, parent: CardData): boolean {
  return child.evolveFrom !== null && child.evolveFrom === parent.name.en;
}
