/** Deck de départ : 2 lignées complètes de types différents et 10 Pokémon de Base. */
import { STARTER_BASICS, STARTER_LINES } from '../content/balance.ts';
import type { CardData, CardIndex, PokemonType, Variant } from './cards.ts';
import { coinFlip, pick, type Rng, sample } from './rng.ts';

/** Part des Pokémon de Base en double, pour permettre les Paires. */
const STARTER_DUPLICATES = 3;

export interface StarterCard {
  cardId: string;
  variant: Variant;
}

interface Line {
  type: PokemonType;
  basics: CardData[];
  stage1: CardData[];
  stage2: CardData[];
}

function isStarterCard(card: CardData): boolean {
  return !card.isTagTeam && ['Common', 'Uncommon', 'Rare'].includes(card.rarity);
}

/** La variante la plus modeste qui existe pour la carte. */
export function plainestVariant(card: CardData): Variant {
  const order: Variant[] = ['normal', 'reverse', 'holo', 'firstEdition'];
  return order.find((variant) => card.variants.includes(variant)) ?? 'normal';
}

export function completeLines(index: CardIndex): Line[] {
  const pool = index.set.cards.filter(isStarterCard);
  const named = (name: string | null) => pool.filter((card) => card.name.en === name);
  const seen = new Set<string>();
  const lines: Line[] = [];
  for (const top of pool.filter((card) => card.stage === 'Stage2')) {
    if (seen.has(top.name.en)) continue;
    seen.add(top.name.en);
    const stage1 = named(top.evolveFrom);
    const basics = named(stage1[0]?.evolveFrom ?? null);
    const type = top.types[0];
    if (type && stage1.length > 0 && basics.length > 0) {
      lines.push({ type, basics, stage1, stage2: named(top.name.en) });
    }
  }
  return lines;
}

function pickLines(rng: Rng, lines: readonly Line[]): Line[] {
  const chosen: Line[] = [];
  for (const line of sample(rng, lines, lines.length)) {
    if (chosen.every((other) => other.type !== line.type)) chosen.push(line);
    if (chosen.length === STARTER_LINES) break;
  }
  return chosen;
}

function basicsOfType(index: CardIndex, type: PokemonType): CardData[] {
  return index.set.cards.filter(
    (card) => isStarterCard(card) && card.stage === 'Basic' && card.types.includes(type),
  );
}

function pickBasics(rng: Rng, index: CardIndex, lineTypes: readonly PokemonType[]): CardData[] {
  const types = [...lineTypes];
  if (coinFlip(rng)) {
    const extra = index.set.cards
      .flatMap((card) => card.types)
      .filter((type) => !types.includes(type));
    if (extra.length > 0) types.push(pick(rng, extra));
  }
  const pool = types.flatMap((type) => basicsOfType(index, type));
  const distinct = sample(rng, pool, STARTER_BASICS - STARTER_DUPLICATES);
  const basics = [...distinct, ...sample(rng, distinct, STARTER_DUPLICATES)];
  while (basics.length < STARTER_BASICS) basics.push(pick(rng, pool));
  return basics;
}

/** Vrai si ces lignées, désignées par leur position, peuvent former un deck de départ. */
export function validStarterLines(index: CardIndex, chosen: readonly number[]): boolean {
  const lines = completeLines(index);
  const picked = chosen.map((position) => lines[position]);
  const types = new Set(picked.map((line) => line?.type));
  return chosen.length === STARTER_LINES && types.size === STARTER_LINES && picked.every(Boolean);
}

/** `chosen` : positions des lignées du deck custom ; sans elles, le tirage décide. */
export function generateStarterDeck(
  rng: Rng,
  index: CardIndex,
  chosen: readonly number[] | null = null,
): StarterCard[] {
  const all = completeLines(index);
  const lines = chosen ? chosen.flatMap((position) => all[position] ?? []) : pickLines(rng, all);
  if (lines.length < STARTER_LINES) throw new Error('Pas assez de lignées pour le deck de départ');
  const cards: CardData[] = [];
  for (const line of lines) {
    const base = pick(rng, line.basics);
    const middle = pick(rng, line.stage1);
    cards.push(base, base, middle, middle, pick(rng, line.stage2));
  }
  const lineTypes = lines.map((line) => line.type);
  cards.push(...pickBasics(rng, index, lineTypes));
  return cards.map((card) => ({ cardId: card.id, variant: plainestVariant(card) }));
}
