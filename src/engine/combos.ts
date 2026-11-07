/** Détection des combinaisons. Les combinaisons comptent des Pokémon, pas des cartes. */
import type { CardData, PokemonType } from './cards.ts';
import { evolvesFrom, POKEMON_TYPES } from './cards.ts';

/** Du plus faible au plus fort, dans l'ordre du tableau du game design. */
export const COMBO_IDS = [
  'single',
  'pair',
  'triple',
  'rainbow',
  'monotype',
  'line',
  'family',
  'quad',
  'monoLine',
  'quint',
] as const;
export type ComboId = (typeof COMBO_IDS)[number];

export const COMBO_VALUES: Record<ComboId, { damage: number; mult: number }> = {
  single: { damage: 10, mult: 1 },
  pair: { damage: 20, mult: 2 },
  triple: { damage: 50, mult: 3 },
  rainbow: { damage: 60, mult: 4 },
  monotype: { damage: 70, mult: 4 },
  line: { damage: 80, mult: 4 },
  family: { damage: 80, mult: 4 },
  quad: { damage: 120, mult: 7 },
  monoLine: { damage: 200, mult: 8 },
  quint: { damage: 300, mult: 12 },
};

/** Rang inférieur pour le statut Colère : Carré tombe sur Brelan, comme dans l'exemple. */
const DEMOTIONS: Record<ComboId, ComboId> = {
  single: 'single',
  pair: 'single',
  triple: 'pair',
  rainbow: 'triple',
  monotype: 'triple',
  line: 'triple',
  family: 'triple',
  quad: 'triple',
  monoLine: 'line',
  quint: 'quad',
};

export function demoteCombo(combo: ComboId, steps: number): ComboId {
  let result = combo;
  for (let i = 0; i < steps; i++) result = DEMOTIONS[result];
  return result;
}

/** Une carte posée, vue par la détection. */
export interface ComboCard {
  data: CardData;
  /** Types effectifs : ceux de la carte et ceux des énergies attachées. */
  types: readonly PokemonType[];
  /** Compte comme tous les types (Polyvalence, ou Incolore avec Prisme). */
  wildcard: boolean;
  /** Valeur qui départage les cartes : dégâts, ou PV avec Colosse. */
  strength: number;
}

export interface DetectedCombo {
  combo: ComboId;
  /** Indices des cartes qui forment la combinaison, de gauche à droite. */
  scoring: number[];
}

function pokemonCount(card: ComboCard): number {
  return Math.max(1, card.data.dexIds.length);
}

function hasType(card: ComboCard, type: PokemonType): boolean {
  return card.wildcard || card.types.includes(type);
}

function strengthOf(cards: readonly ComboCard[], indices: readonly number[]): number {
  return indices.reduce((sum, index) => sum + (cards[index]?.strength ?? 0), 0);
}

/** Groupes de cartes par Pokémon ; une carte TAG TEAM appartient à plusieurs groupes. */
function groupByPokemon(cards: readonly ComboCard[]): number[][] {
  const groups = new Map<number, number[]>();
  cards.forEach((card, index) => {
    for (const dexId of card.data.dexIds) {
      const group = groups.get(dexId);
      if (group) group.push(index);
      else groups.set(dexId, [index]);
    }
  });
  return [...groups.values()].sort(
    (a, b) => b.length - a.length || strengthOf(cards, b) - strengthOf(cards, a),
  );
}

/** Le type qui réunit le plus de Pokémon, s'il en réunit au moins 5. */
function bestMonotype(cards: readonly ComboCard[]): number[] | null {
  let best: number[] | null = null;
  let bestCount = 0;
  for (const type of POKEMON_TYPES) {
    const indices = cards.flatMap((card, index) => (hasType(card, type) ? [index] : []));
    const count = indices.reduce((sum, index) => {
      const card = cards[index];
      return sum + (card ? pokemonCount(card) : 0);
    }, 0);
    const better =
      count > bestCount ||
      (count === bestCount &&
        best !== null &&
        strengthOf(cards, indices) > strengthOf(cards, best));
    if (count >= 5 && better) {
      best = indices;
      bestCount = count;
    }
  }
  return best;
}

/** La lignée Base → Niveau 1 → Niveau 2 la plus forte parmi `candidates`. */
function bestLine(cards: readonly ComboCard[], candidates: readonly number[]): number[] | null {
  let best: number[] | null = null;
  const atStage = (stage: CardData['stage']) =>
    candidates.filter((index) => cards[index]?.data.stage === stage);
  for (const top of atStage('Stage2')) {
    for (const middle of atStage('Stage1')) {
      for (const base of atStage('Basic')) {
        const [c, b, a] = [cards[top], cards[middle], cards[base]];
        if (!a || !b || !c) continue;
        if (!evolvesFrom(c.data, b.data) || !evolvesFrom(b.data, a.data)) continue;
        const line = [base, middle, top];
        if (!best || strengthOf(cards, line) > strengthOf(cards, best)) best = line;
      }
    }
  }
  return best;
}

/**
 * Arc-en-ciel : affectation d'un type distinct à chaque Pokémon (couplage biparti).
 * Une carte fournit au plus autant de types qu'elle compte de Pokémon.
 */
function rainbowCards(cards: readonly ComboCard[]): number[] | null {
  const slots = cards.flatMap((card, index) =>
    Array.from({ length: pokemonCount(card) }, () => index),
  );
  const owner = new Map<PokemonType, number>();
  const assign = (slot: number, seen: Set<PokemonType>): boolean => {
    const card = cards[slots[slot] as number] as ComboCard;
    for (const type of POKEMON_TYPES) {
      if (!hasType(card, type) || seen.has(type)) continue;
      seen.add(type);
      const current = owner.get(type);
      if (current === undefined || assign(current, seen)) {
        owner.set(type, slot);
        return true;
      }
    }
    return false;
  };
  slots.forEach((_, slot) => {
    assign(slot, new Set());
  });
  if (owner.size < 5) return null;
  const indices = new Set([...owner.values()].map((slot) => slots[slot] as number));
  return [...indices].sort((a, b) => a - b);
}

function sorted(indices: Iterable<number>): number[] {
  return [...new Set(indices)].sort((a, b) => a - b);
}

/** La meilleure combinaison des cartes posées, de la plus forte à la plus faible. */
export function detectCombo(cards: readonly ComboCard[]): DetectedCombo {
  const groups = groupByPokemon(cards);
  const largest = groups[0] ?? [];
  const everyIndex = cards.map((_, index) => index);

  if (largest.length >= 5) return { combo: 'quint', scoring: sorted(largest) };

  const monotype = bestMonotype(cards);
  if (monotype && bestLine(cards, monotype)) return { combo: 'monoLine', scoring: monotype };

  if (largest.length === 4) return { combo: 'quad', scoring: sorted(largest) };

  if (largest.length === 3) {
    const pair = groups.slice(1).find((group) => group.length >= 2);
    if (pair) return { combo: 'family', scoring: sorted([...largest, ...pair]) };
  }

  const line = bestLine(cards, everyIndex);
  if (line) return { combo: 'line', scoring: sorted(line) };

  if (monotype) return { combo: 'monotype', scoring: monotype };

  const rainbow = rainbowCards(cards);
  if (rainbow) return { combo: 'rainbow', scoring: rainbow };

  if (largest.length === 3) return { combo: 'triple', scoring: sorted(largest) };
  if (largest.length === 2) return { combo: 'pair', scoring: sorted(largest) };

  const strongest = everyIndex.reduce(
    (best, index) => ((cards[index]?.strength ?? 0) > (cards[best]?.strength ?? 0) ? index : best),
    0,
  );
  return { combo: 'single', scoring: [strongest] };
}
