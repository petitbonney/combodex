/**
 * Générateur à graine (mulberry32). L'état tient dans un objet sérialisable rangé dans l'état
 * de la run : une même graine et les mêmes actions rejouent une run à l'identique.
 */

export interface Rng {
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

/** Graine numérique tirée d'un texte, pour les codes de graine partageables (FNV-1a). */
export function seedFromText(text: string): number {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Flottant dans [0, 1). */
export function nextFloat(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let value = rng.state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

/** Entier dans [0, max). */
export function nextInt(rng: Rng, max: number): number {
  return Math.floor(nextFloat(rng) * max);
}

/** Pile ou face : vrai sur face. */
export function coinFlip(rng: Rng): boolean {
  return nextFloat(rng) < 0.5;
}

/** Dé à `sides` faces, de 1 à `sides`. */
export function rollDie(rng: Rng, sides: number): number {
  return nextInt(rng, sides) + 1;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[nextInt(rng, items.length)];
  if (item === undefined) throw new Error('Tirage dans une liste vide');
  return item;
}

/** Mélange de Fisher-Yates ; renvoie une nouvelle liste. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/** Tire `count` éléments distincts. */
export function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  return shuffle(rng, items).slice(0, count);
}

/** Tirage pondéré ; les poids sont positifs. */
export function weightedPick<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = nextFloat(rng) * total;
  for (const [item, weight] of entries) {
    roll -= weight;
    if (roll < 0) return item;
  }
  const last = entries.at(-1);
  if (!last) throw new Error('Tirage pondéré dans une liste vide');
  return last[0];
}
