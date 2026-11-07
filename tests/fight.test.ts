import { describe, expect, it } from 'vitest';
import { RETREAT_POINTS } from '../src/content/balance.ts';
import { isHidden, maxPlayed, previewHand } from '../src/engine/fight.ts';
import { createRng } from '../src/engine/rng.ts';
import { applyAction, createRun } from '../src/engine/run.ts';
import { IllegalActionError, type RunState } from '../src/engine/state.ts';
import { card, fightRun, fillers, indexOf, opponent, tool } from './helpers.ts';

const fight = (state: RunState) => {
  if (!state.fight) throw new Error('Pas de combat');
  return state.fight;
};

const strongOpponent = { opponent: opponent({ hp: 100000, maxHp: 100000 }) };

describe('début de combat', () => {
  const start = () => createRun(indexOf(cardsForRun()), { seed: 3 });

  function cardsForRun() {
    const base = card({ id: 'a', name: { fr: 'A', en: 'A' }, types: ['Fire'] });
    const mid = card({
      id: 'b',
      name: { fr: 'B', en: 'B' },
      stage: 'Stage1',
      evolveFrom: 'A',
      types: ['Fire'],
    });
    const top = card({
      id: 'c',
      name: { fr: 'C', en: 'C' },
      stage: 'Stage2',
      evolveFrom: 'B',
      types: ['Fire'],
    });
    const base2 = card({ id: 'd', name: { fr: 'D', en: 'D' }, types: ['Water'] });
    const mid2 = card({
      id: 'e',
      name: { fr: 'E', en: 'E' },
      stage: 'Stage1',
      evolveFrom: 'D',
      types: ['Water'],
    });
    const top2 = card({
      id: 'f',
      name: { fr: 'F', en: 'F' },
      stage: 'Stage2',
      evolveFrom: 'E',
      types: ['Water'],
    });
    return [base, mid, top, base2, mid2, top2, ...fillers(12, { types: ['Fire'] })];
  }

  it('pioche 8 cartes dans un deck mélangé, avec 4 Tours et 4 points de Retraite', () => {
    const runIndex = indexOf(cardsForRun());
    const { state, events } = applyAction(start(), { type: 'startFight' }, runIndex);
    const current = fight(state);
    expect(current.hand).toHaveLength(8);
    expect(current.drawPile).toHaveLength(12);
    expect(current.maxTurns).toBe(4);
    expect(current.turn).toBe(1);
    expect(current.retreatPoints).toBe(RETREAT_POINTS);
    expect(events.map((event) => event.type)).toContain('fightStarted');
  });

  it("laisse l'état reçu intact", () => {
    const runIndex = indexOf(cardsForRun());
    const run = start();
    const copy = structuredClone(run);
    applyAction(run, { type: 'startFight' }, runIndex);
    expect(run).toEqual(copy);
  });
});

describe('poser des cartes', () => {
  const deck = fillers(20);
  const index = indexOf(deck);
  const state = () => fightRun({ deck, fight: strongOpponent });

  it('accepte de 1 à 5 cartes', () => {
    expect(() => applyAction(state(), { type: 'play', uids: [] }, index)).toThrow(
      IllegalActionError,
    );
    expect(() => applyAction(state(), { type: 'play', uids: [0, 1, 2, 3, 4, 5] }, index)).toThrow(
      IllegalActionError,
    );
    expect(() =>
      applyAction(state(), { type: 'play', uids: [0, 1, 2, 3, 4] }, index),
    ).not.toThrow();
  });

  it('refuse une carte absente de la main ou posée deux fois', () => {
    expect(() => applyAction(state(), { type: 'play', uids: [15] }, index)).toThrow(/notInHand/);
    expect(() => applyAction(state(), { type: 'play', uids: [0, 0] }, index)).toThrow(
      /duplicateCard/,
    );
  });

  it('Grand banc : permet de poser 6 cartes', () => {
    const run = fightRun({ deck, fight: strongOpponent, tools: [tool(50, 'bigBench')] });
    expect(maxPlayed(run, fight(run))).toBe(6);
    expect(() => applyAction(run, { type: 'play', uids: [0, 1, 2, 3, 4, 5] }, index)).not.toThrow();
  });

  it('Grand banc désactivé : retour à 5 cartes', () => {
    const run = fightRun({
      deck,
      fight: { ...strongOpponent, fightDisabledToolUids: [50] },
      tools: [tool(50, 'bigBench')],
    });
    expect(maxPlayed(run, fight(run))).toBe(5);
  });

  it('retire le score des PV, consomme un Tour et complète la main', () => {
    const { state: after } = applyAction(state(), { type: 'play', uids: [0, 1] }, index);
    const current = fight(after);
    expect(current.opponent.hp).toBeLessThan(100000);
    expect(current.turn).toBe(2);
    expect(current.hand).toHaveLength(8);
    expect(current.drawPile).toHaveLength(10);
  });

  it('les cartes jouées quittent la main sans revenir en défausse', () => {
    const { state: after } = applyAction(state(), { type: 'play', uids: [0] }, index);
    expect(fight(after).hand).not.toContain(0);
    expect(fight(after).discardPile).toEqual([]);
  });

  it('enregistre les statistiques de la main', () => {
    const { state: after } = applyAction(state(), { type: 'play', uids: [0] }, index);
    expect(after.stats.handsPlayed).toBe(1);
    expect(after.stats.comboCounts.single).toBe(1);
    expect(after.stats.seenDexIds).toHaveLength(1);
    expect(after.stats.bestHand).toBe(60);
  });

  it("Entraînement : garde son gain d'une main à l'autre", () => {
    const base = card({ id: 'a', name: { fr: 'A', en: 'A' } });
    const mid = card({ id: 'b', name: { fr: 'B', en: 'B' }, stage: 'Stage1', evolveFrom: 'A' });
    const top = card({ id: 'c', name: { fr: 'C', en: 'C' }, stage: 'Stage2', evolveFrom: 'B' });
    const cards = [base, mid, top, ...fillers(10)];
    const run = fightRun({
      deck: cards,
      fight: strongOpponent,
      tools: [tool(50, 'training')],
    });
    const { state: after } = applyAction(run, { type: 'play', uids: [0, 1, 2] }, indexOf(cards));
    expect(after.tools[0]?.stacks).toBe(1);
  });
});

describe('défausse par la retraite', () => {
  const cards = [
    card({ id: 'r0', retreat: 0 }),
    card({ id: 'r1', retreat: 1 }),
    card({ id: 'r3', retreat: 3 }),
    card({ id: 'r4', retreat: 4 }),
    ...fillers(10),
  ];
  const index = indexOf(cards);
  const state = () => fightRun({ deck: cards, hand: [0, 1, 2, 3], fight: strongOpponent });

  it('chaque carte coûte sa valeur de retraite, sans consommer de Tour', () => {
    const { state: after } = applyAction(state(), { type: 'discard', uids: [1, 2] }, index);
    expect(fight(after).retreatPoints).toBe(0);
    expect(fight(after).turn).toBe(1);
    expect(fight(after).discardPile).toEqual([1, 2]);
  });

  it('une carte à retraite 0 ne coûte rien', () => {
    const { state: after } = applyAction(state(), { type: 'discard', uids: [0] }, index);
    expect(fight(after).retreatPoints).toBe(4);
  });

  it('refuse une défausse trop chère', () => {
    expect(() => applyAction(state(), { type: 'discard', uids: [2, 3] }, index)).toThrow(
      /notEnoughRetreat/,
    );
  });

  it('complète la main après la défausse', () => {
    const run = fightRun({ deck: cards, hand: [0, 1, 2, 3, 4, 5, 6, 7], fight: strongOpponent });
    const { state: after } = applyAction(run, { type: 'discard', uids: [0] }, index);
    expect(fight(after).hand).toHaveLength(8);
  });

  it('Sac léger : défausser une carte à retraite 0 rapporte 1 ₽', () => {
    const run = fightRun({
      deck: cards,
      hand: [0, 1],
      fight: strongOpponent,
      tools: [tool(50, 'lightBag')],
    });
    const { state: after } = applyAction(run, { type: 'discard', uids: [0, 1] }, index);
    expect(after.money).toBe(1);
  });

  it('Racines : le coût augmente', () => {
    const run = fightRun({
      deck: cards,
      hand: [0, 2],
      fight: {
        ...strongOpponent,
        activeStatus: { id: 'roots', strong: false, sourceId: 'roots' },
      },
    });
    // Retraite 0 + 1, puis retraite 3 + 1 : 5 points, pour 4 disponibles.
    expect(() => applyAction(run, { type: 'discard', uids: [0, 2] }, index)).toThrow(
      /notEnoughRetreat/,
    );
    const { state: after } = applyAction(run, { type: 'discard', uids: [2] }, index);
    expect(fight(after).retreatPoints).toBe(0);
  });
});

describe('fin de combat', () => {
  const deck = fillers(20);
  const index = indexOf(deck);

  it('Tours épuisés : fin de run', () => {
    const run = fightRun({ deck, fight: { ...strongOpponent, turn: 4 } });
    const { state, events } = applyAction(run, { type: 'play', uids: [0] }, index);
    expect(state.phase).toBe('lost');
    expect(events).toContainEqual({ type: 'fightLost' });
  });

  it('PV à zéro : victoire et boutique', () => {
    const cards = [...deck, card({ id: 'x' })];
    const run = fightRun({
      deck: cards,
      fight: { opponent: opponent({ hp: 10, kind: 'trainer' }) },
    });
    const { state } = applyAction(run, { type: 'play', uids: [0] }, indexOf(cards));
    expect(state.phase).toBe('shop');
    expect(state.fight).toBeNull();
    expect(state.stats.fightsWon).toBe(1);
  });

  it('le Marqueur peut achever le Champion hors calcul', () => {
    const counters = card({ id: 'c', abilityFamily: 'counters', bestDamage: 10 });
    const cards = [counters, ...fillers(10)];
    const run = fightRun({
      deck: cards,
      fight: { opponent: opponent({ hp: 40, maxHp: 1000, kind: 'trainer' }) },
    });
    const { state } = applyAction(run, { type: 'play', uids: [0] }, indexOf(cards));
    expect(state.phase).toBe('shop');
  });

  it("l'Affliction peut achever le Champion en fin de Tour", () => {
    const cards = fillers(20, { bestDamage: 10 });
    const run = fightRun({
      deck: cards,
      fight: { afflicted: true, opponent: opponent({ hp: 40, maxHp: 1000, kind: 'trainer' }) },
    });
    const { state, events } = applyAction(run, { type: 'play', uids: [0] }, indexOf(cards));
    expect(events.some((event) => event.type === 'afflictionTick')).toBe(true);
    expect(state.phase).toBe('shop');
  });

  it('deck et main vides : fin de run', () => {
    const cards = fillers(1);
    const run = fightRun({ deck: cards, hand: [0], drawPile: [], fight: strongOpponent });
    const { state } = applyAction(run, { type: 'play', uids: [0] }, indexOf(cards));
    expect(state.phase).toBe('lost');
  });
});

describe('effets permanents dans le combat', () => {
  it('Électrique : 3 Tours au lieu de 4', () => {
    const cards = lineCards();
    const index = indexOf(cards);
    const run = createRun(index, { seed: 1 });
    run.stageIndex = 2;
    run.arenas[0] = { type: 'Lightning', form: 'permanent', championCardId: 'boss' };
    const { state } = applyAction(run, { type: 'startFight' }, index);
    expect(fight(state).maxTurns).toBe(3);
  });

  it('Obscurité : un Outil est désactivé pendant le combat', () => {
    const cards = lineCards();
    const index = indexOf(cards);
    const run = createRun(index, { seed: 1 });
    run.stageIndex = 2;
    run.tools = [tool(50, 'prism')];
    run.arenas[0] = { type: 'Darkness', form: 'permanent', championCardId: 'boss' };
    const { state } = applyAction(run, { type: 'startFight' }, index);
    expect(fight(state).fightDisabledToolUids).toEqual([50]);
  });

  it('Psy : des cartes sont tirées face cachée, jamais toutes ni aucune sur la durée', () => {
    const cards = lineCards();
    const index = indexOf(cards);
    let hidden = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const run = createRun(index, { seed });
      run.stageIndex = 2;
      run.arenas[0] = { type: 'Psychic', form: 'permanent', championCardId: 'boss' };
      const { state } = applyAction(run, { type: 'startFight' }, index);
      const current = fight(state);
      hidden += current.hand.filter((uid) => isHidden(current, uid)).length;
      total += current.hand.length;
    }
    expect(hidden / total).toBeGreaterThan(0.4);
    expect(hidden / total).toBeLessThan(0.6);
  });

  it('Plante : le Champion récupère 10 % de ses PV à chaque Tour', () => {
    const deck = fillers(20);
    const run = fightRun({
      deck,
      fight: { opponent: opponent({ form: 'permanent', type: 'Grass', hp: 500, maxHp: 1000 }) },
    });
    const { events } = applyAction(run, { type: 'play', uids: [0] }, indexOf(deck));
    expect(events).toContainEqual({ type: 'opponentHealed', amount: 100 });
  });

  it("Feu : les cartes défaussées quittent le deck jusqu'à la fin de l'Arène", () => {
    const deck = fillers(20);
    const run = fightRun({
      deck,
      fight: { opponent: opponent({ form: 'permanent', type: 'Fire' }) },
    });
    const { state } = applyAction(run, { type: 'discard', uids: [0] }, indexOf(deck));
    expect(state.arenaBanishedUids).toEqual([0]);
    expect(fight(state).discardPile).toEqual([]);
  });
});

describe('aperçu', () => {
  const deck = fillers(20);
  const index = indexOf(deck);

  it("estime le score sans toucher à l'état ni au générateur", () => {
    const run = fightRun({ deck, run: { rng: createRng(5) } });
    const before = structuredClone(run);
    const preview = previewHand(run, index, [0, 1]);
    expect(preview.score).toBeGreaterThan(0);
    expect(run).toEqual(before);
  });

  it('annonce le même score que la main réellement jouée', () => {
    const run = fightRun({ deck, fight: strongOpponent });
    const preview = previewHand(run, index, [0]);
    const { events } = applyAction(run, { type: 'play', uids: [0] }, index);
    const played = events.find((event) => event.type === 'handPlayed');
    expect(played && 'result' in played ? played.result.score : -1).toBe(preview.score);
  });
});

describe('Outils réordonnables', () => {
  const deck = fillers(10);
  const index = indexOf(deck);
  const tools = [tool(50, 'prism'), tool(51, 'picnic')];

  it("change l'ordre des emplacements entre deux Tours", () => {
    const run = fightRun({ deck, tools, fight: strongOpponent });
    const { state } = applyAction(run, { type: 'reorderTools', uids: [51, 50] }, index);
    expect(state.tools.map((entry) => entry.uid)).toEqual([51, 50]);
  });

  it('refuse un ordre incomplet', () => {
    const run = fightRun({ deck, tools });
    expect(() => applyAction(run, { type: 'reorderTools', uids: [51] }, index)).toThrow();
  });
});

function lineCards() {
  const chain = (prefix: string, type: 'Fire' | 'Water') => [
    card({ id: `${prefix}1`, name: { fr: `${prefix}1`, en: `${prefix}1` }, types: [type] }),
    card({
      id: `${prefix}2`,
      name: { fr: `${prefix}2`, en: `${prefix}2` },
      types: [type],
      stage: 'Stage1',
      evolveFrom: `${prefix}1`,
    }),
    card({
      id: `${prefix}3`,
      name: { fr: `${prefix}3`, en: `${prefix}3` },
      types: [type],
      stage: 'Stage2',
      evolveFrom: `${prefix}2`,
    }),
  ];
  return [
    ...chain('fire', 'Fire'),
    ...chain('water', 'Water'),
    ...fillers(14, { types: ['Fire'] }),
    card({ id: 'boss', types: ['Lightning'] }),
    card({ id: 'boss2', types: ['Psychic'] }),
    card({ id: 'boss3', types: ['Darkness'] }),
  ];
}
