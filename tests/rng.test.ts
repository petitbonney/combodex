import { describe, expect, it } from 'vitest';
import {
  coinFlip,
  createRng,
  nextFloat,
  nextInt,
  rollDie,
  seedFromText,
  shuffle,
  weightedPick,
} from '../src/engine/rng.ts';

describe('générateur à graine', () => {
  it('rejoue la même suite pour une même graine', () => {
    const a = createRng(42);
    const b = createRng(42);
    const values = Array.from({ length: 20 }, () => nextFloat(a));
    expect(Array.from({ length: 20 }, () => nextFloat(b))).toEqual(values);
  });

  it('donne deux suites différentes pour deux graines', () => {
    expect(nextFloat(createRng(1))).not.toBe(nextFloat(createRng(2)));
  });

  it('reste dans ses bornes', () => {
    const rng = createRng(7);
    for (let i = 0; i < 2000; i++) {
      const float = nextFloat(rng);
      expect(float).toBeGreaterThanOrEqual(0);
      expect(float).toBeLessThan(1);
      expect(nextInt(rng, 5)).toBeLessThan(5);
      const die = rollDie(rng, 6);
      expect(die).toBeGreaterThanOrEqual(1);
      expect(die).toBeLessThanOrEqual(6);
    }
  });

  it('équilibre pile et face', () => {
    const rng = createRng(3);
    const heads = Array.from({ length: 10000 }, () => coinFlip(rng)).filter(Boolean).length;
    expect(heads).toBeGreaterThan(4800);
    expect(heads).toBeLessThan(5200);
  });

  it('mélange sans perdre de cartes ni toucher à la liste reçue', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shuffle(createRng(9), items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(shuffled).not.toEqual(items);
  });

  it('respecte les poids du tirage', () => {
    const rng = createRng(11);
    const draws = Array.from({ length: 5000 }, () =>
      weightedPick(rng, [
        ['rare', 1],
        ['commun', 9],
      ] as const),
    );
    const rare = draws.filter((draw) => draw === 'rare').length;
    expect(rare).toBeGreaterThan(400);
    expect(rare).toBeLessThan(600);
  });

  it("tire une graine stable d'un texte", () => {
    expect(seedFromText('combodex')).toBe(seedFromText('combodex'));
    expect(seedFromText('combodex')).not.toBe(seedFromText('combodey'));
  });
});
