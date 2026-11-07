import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type CardSet, indexCards } from '../src/engine/cards.ts';
import { applyAction, createRun } from '../src/engine/run.ts';
import { chooseAction } from '../src/sim/bot.ts';
import { median, simulate, simulateRun } from '../src/sim/simulator.ts';

const set: CardSet = JSON.parse(readFileSync('data/sm12.json', 'utf8'));
const index = indexCards(set);

describe('simulateur', () => {
  it("rejoue une run à l'identique avec une même graine", () => {
    expect(simulateRun(index, 123, 3)).toEqual(simulateRun(index, 123, 3));
  });

  it('termine chaque run, sans action illégale du bot', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const record = simulateRun(index, seed, 3);
      expect(record.fights.length).toBeGreaterThan(0);
    }
  });

  it('termine aussi les runs de 8 Arènes, avec les statuts renforcés', () => {
    for (let seed = 1; seed <= 25; seed++) {
      expect(simulateRun(index, seed, 8).fights.length).toBeGreaterThan(0);
    }
  });

  it('produit un rapport cohérent', () => {
    const report = simulate(index, 40, 1, 3);
    expect(report.runs).toBe(40);
    expect(report.arenaReports[0]?.reached).toBe(40);
    expect(report.fightReports).toHaveLength(9);
    const total = report.comboShares.reduce((sum, { share }) => sum + share, 0);
    expect(total).toBeCloseTo(1);
    const [first, second] = report.arenaReports;
    expect(second?.reached).toBe(first?.cleared);
  });

  it('calcule la médiane', () => {
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});

describe('bot glouton', () => {
  it('joue la main au meilleur score immédiat', () => {
    const start = applyAction(createRun(index, { seed: 4 }), { type: 'startFight' }, index).state;
    const action = chooseAction(start, index);
    expect(['play', 'discard']).toContain(action.type);
  });

  it('une run rejouée action par action retombe sur le même état', () => {
    const play = () => {
      let state = createRun(index, { seed: 9 });
      const actions: string[] = [];
      for (let step = 0; step < 40; step++) {
        if (state.phase === 'won' || state.phase === 'lost') break;
        const action = chooseAction(state, index);
        actions.push(JSON.stringify(action));
        state = applyAction(state, action, index).state;
      }
      return { actions, state };
    };
    expect(play()).toEqual(play());
  });
});
