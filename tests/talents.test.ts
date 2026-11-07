import { describe, expect, it } from 'vitest';
import type { AbilityFamily } from '../src/engine/cards.ts';
import { retreatCost, scoutedCards } from '../src/engine/fight.ts';
import { createRng } from '../src/engine/rng.ts';
import { applyAction } from '../src/engine/run.ts';
import { scoreHand } from '../src/engine/scoring.ts';
import type { ActionResult, FightState, RunState } from '../src/engine/state.ts';
import { card, fightRun, fillers, indexOf, instance, opponent, scoreInput } from './helpers.ts';

const talent = (abilityFamily: AbilityFamily, overrides = {}) =>
  card({ id: `talent-${abilityFamily}`, abilityFamily, ...overrides });

function fightOf(state: RunState): FightState {
  if (!state.fight) throw new Error('Pas de combat');
  return state.fight;
}

/** Joue la première carte de la main contre un adversaire qui survit. */
function playFirst(deck: ReturnType<typeof card>[], setup: Partial<FightState> = {}) {
  const index = indexOf(deck);
  const state = fightRun({ deck, hand: [0, 1], fight: setup });
  return { index, result: applyAction(state, { type: 'play', uids: [0] }, index) };
}

describe('talents calculés dans la main', () => {
  it('Copie : marque les Dégâts de la carte la plus forte de la main', () => {
    const copy = talent('copy', { bestDamage: 20 });
    const strong = card({ id: 'x', bestDamage: 120 });
    const result = scoreHand(scoreInput([copy], [copy, strong], { hand: [instance(5, strong)] }));
    expect(result.damage).toBe(10 + 120);
  });

  it('Copie : garde ses dégâts si la main est plus faible', () => {
    const copy = talent('copy', { bestDamage: 80 });
    const weak = card({ id: 'x', bestDamage: 10 });
    const result = scoreHand(scoreInput([copy], [copy, weak], { hand: [instance(5, weak)] }));
    expect(result.damage).toBe(10 + 80);
  });

  it('Polyvalence : compte comme tous les types pour les combinaisons', () => {
    const fire = fillers(4, { types: ['Fire'] });
    const wild = talent('versatile', { types: ['Water'] });
    const cards = [...fire, wild];
    expect(scoreHand(scoreInput(cards, cards)).combo).toBe('monotype');
  });

  it('Marqueurs : 2 % des PV max, hors calcul', () => {
    const data = talent('counters');
    const result = scoreHand(
      scoreInput([data], [data], {
        opponent: { maxHp: 1000, weaknesses: ['Fire'], resistances: [] },
      }),
    );
    expect(result.flatDamage).toBe(20);
    expect(result.score).toBe((10 + 50) * 2);
  });

  it('Puissance : +20 Dégâts aux autres cartes du même type', () => {
    const power = talent('power', { dexIds: [800], types: ['Fire'], bestDamage: 50 });
    const friend = card({ id: 'f', dexIds: [800], types: ['Fire'], bestDamage: 50 });
    const result = scoreHand(scoreInput([power, friend], [power, friend]));
    expect(result.damage).toBe(20 + 50 + 50 + 20);
  });

  it("Puissance : n'aide pas les autres types", () => {
    const power = talent('power', { dexIds: [801], types: ['Fire'] });
    const friend = card({ id: 'f', dexIds: [801], types: ['Water'] });
    const result = scoreHand(scoreInput([power, friend], [power, friend]));
    expect(result.damage).toBe(20 + 50 + 50);
  });

  it('Banc : +1 Multi par carte restée en main', () => {
    const data = talent('bench');
    const others = fillers(3);
    const hand = others.map((other, position) => instance(10 + position, other));
    const result = scoreHand(scoreInput([data], [data, ...others], { hand }));
    expect(result.mult).toBe(1 + 3);
  });

  it('Générique : +2 Multi', () => {
    const data = talent('generic');
    expect(scoreHand(scoreInput([data], [data])).mult).toBe(3);
  });

  it('Pile ou face : ×2 Multi sur face, rien sur pile', () => {
    const data = talent('coinFlip');
    const mults = new Set<number>();
    for (let seed = 0; seed < 20; seed++) {
      mults.add(scoreHand(scoreInput([data], [data], { rng: createRng(seed) })).mult);
    }
    expect([...mults].sort()).toEqual([1, 2]);
  });

  it('Protection : la carte ignore la résistance', () => {
    const data = talent('shield', { types: ['Fire'], bestDamage: 50 });
    const result = scoreHand(
      scoreInput([data], [data], {
        opponent: { maxHp: 1000, weaknesses: [], resistances: ['Fire'] },
      }),
    );
    expect(result.damage).toBe(60);
  });

  it('Protection : la carte ignore les statuts', () => {
    const data = talent('shield', { bestDamage: 50 });
    const result = scoreHand(
      scoreInput([data], [data], { rules: { silencedFirst: 1, damagePenaltyPerCard: 10 } }),
    );
    expect(result.scoringUids).toEqual([1]);
    expect(result.damage).toBe(60);
  });

  it('Protection : ne protège pas des effets permanents', () => {
    const data = talent('shield', { types: ['Fire'] });
    const result = scoreHand(scoreInput([data], [data], { rules: { noScoreTypes: ['Fire'] } }));
    expect(result.scoringUids).toEqual([]);
  });

  it('un talent ne se déclenche pas si la carte ne marque pas', () => {
    const data = talent('generic');
    const result = scoreHand(scoreInput([data], [data], { rules: { silencedFirst: 1 } }));
    expect(result.mult).toBe(1);
  });

  it('un talent hors combinaison ne se déclenche pas', () => {
    const generic = talent('generic', { dexIds: [830] });
    const [a, b] = fillers(2, { dexIds: [831] });
    const cards = [generic, a, b] as never;
    const result = scoreHand(scoreInput(cards, cards));
    expect(result.combo).toBe('pair');
    expect(result.mult).toBe(2);
  });
});

describe('talents résolus après la main', () => {
  it('Affliction : le Champion perd 3 % à chaque fin de Tour, sans cumul', () => {
    const data = talent('affliction');
    const filler = fillers(3);
    const deck = [data, data, ...filler];
    const index = indexOf(deck);
    const start = fightRun({ deck, hand: [0, 1, 2, 3] });
    const first = applyAction(start, { type: 'play', uids: [0] }, index);
    expect(first.events.filter((event) => event.type === 'afflictionTick')).toEqual([
      { type: 'afflictionTick', amount: 30 },
    ]);
    const second = applyAction(first.state, { type: 'play', uids: [1] }, index);
    expect(second.events.filter((event) => event.type === 'afflictionTick')).toHaveLength(1);
  });

  it('Soin : annule le prochain statut annoncé', () => {
    const { result } = playFirst([talent('heal'), ...fillers(9)], {
      announcedStatus: 'furnace',
      opponent: opponent({ form: 'statuses', type: 'Fire' }),
    });
    expect(result.events).toContainEqual({ type: 'statusCancelled', id: 'furnace' });
    expect(fightOf(result.state).activeStatus).toBeNull();
  });

  it('Pioche : 1 carte de plus au prochain Tour', () => {
    const { result } = playFirst([talent('draw'), ...fillers(12)]);
    expect(fightOf(result.state).hand).toHaveLength(9);
  });

  it('Défausse : +1 point de Retraite pour le reste du combat', () => {
    const { result } = playFirst([talent('discard'), ...fillers(9)]);
    expect(fightOf(result.state).retreatPoints).toBe(5);
  });

  it('Énergie : une carte du deck reçoit une énergie de son type, pour toujours', () => {
    const { result } = playFirst([talent('energy'), ...fillers(9, { types: ['Water'] })]);
    const energized = result.state.deck.filter((entry) => entry.energies.length > 0);
    expect(energized).toHaveLength(1);
    expect(['Fire', 'Water']).toContain(energized[0]?.energies[0]);
  });

  it('Récupération : la dernière carte défaussée revient en main', () => {
    const deck = [talent('recovery'), ...fillers(9)];
    const index = indexOf(deck);
    const start = fightRun({ deck, hand: [0, 1, 2] });
    const { state } = applyAction(start, { type: 'discard', uids: [1] }, index);
    const { events, state: after } = applyAction(state, { type: 'play', uids: [0] }, index);
    expect(events).toContainEqual({ type: 'cardRecovered', uid: 1 });
    expect(fightOf(after).hand).toContain(1);
    expect(fightOf(after).discardPile).toEqual([]);
  });

  it('Recherche : au prochain Tour, le joueur choisit parmi les 3 du dessus', () => {
    const deck = [talent('search'), ...fillers(12)];
    const index = indexOf(deck);
    const start = fightRun({ deck, hand: [0, 1, 2, 3, 4, 5, 6, 7] });
    const { state } = applyAction(start, { type: 'play', uids: [0] }, index);
    const fight = fightOf(state);
    expect(fight.searchChoices).toHaveLength(3);
    expect(() => applyAction(state, { type: 'play', uids: [1] }, index)).toThrow();
    const chosen = fight.searchChoices?.[1] as number;
    const after = applyAction(state, { type: 'resolveSearch', uid: chosen }, index).state;
    expect(fightOf(after).hand).toContain(chosen);
    expect(fightOf(after).hand).toHaveLength(9);
    expect(fightOf(after).drawPile).not.toContain(chosen);
    expect(fightOf(after).searchChoices).toBeNull();
  });

  it('Récompense : +2 ₽ si la main bat le Champion', () => {
    const deck = [talent('reward'), ...fillers(9)];
    const index = indexOf(deck);
    const state = fightRun({
      deck,
      hand: [0, 1],
      fight: { opponent: opponent({ hp: 1, kind: 'trainer' }) },
    });
    const { events }: ActionResult = applyAction(state, { type: 'play', uids: [0] }, index);
    const won = events.find((event) => event.type === 'fightWon');
    expect(won && 'gains' in won ? won.gains.reward : 0).toBe(2);
  });

  it("Récompense : pas de ₽ si l'Affliction achève l'adversaire en fin de Tour", () => {
    const deck = [talent('reward', { bestDamage: 10 }), ...fillers(9)];
    const index = indexOf(deck);
    const state = fightRun({
      deck,
      hand: [0, 1],
      fight: {
        afflicted: true,
        opponent: opponent({ hp: 40, maxHp: 1000, kind: 'trainer' }),
      },
    });
    const { events } = applyAction(state, { type: 'play', uids: [0] }, index);
    const won = events.find((event) => event.type === 'fightWon');
    expect(won && 'gains' in won ? won.gains.reward : -1).toBe(0);
  });

  describe('Évolution', () => {
    const base = card({ id: 'base', name: { fr: 'A', en: 'A' } });
    const evolved = card({
      id: 'evolved',
      name: { fr: 'B', en: 'B' },
      stage: 'Stage1',
      evolveFrom: 'A',
      abilityFamily: 'evolution',
    });
    const deck = [evolved, base, ...fillers(8)];

    it('une Base de sa lignée évolue, en gardant variante et énergies', () => {
      const index = indexOf(deck);
      const state = fightRun({ deck, hand: [0, 2] });
      state.deck[1] = instance(1, base, 'reverse', ['Water']);
      const { state: after, events } = applyAction(state, { type: 'play', uids: [0] }, index);
      expect(after.deck[1]).toMatchObject({
        cardId: 'evolved',
        variant: 'reverse',
        energies: ['Water'],
      });
      expect(events).toContainEqual({
        type: 'cardEvolved',
        uid: 1,
        fromId: 'base',
        toId: 'evolved',
      });
    });

    it('une Base à plusieurs évolutions suit la carte qui déclenche le talent', () => {
      const eevee = card({ id: 'eevee', name: { fr: 'E', en: 'E' } });
      const other = card({
        id: 'other',
        name: { fr: 'O', en: 'O' },
        stage: 'Stage1',
        evolveFrom: 'E',
      });
      const source = card({
        id: 'source',
        name: { fr: 'S', en: 'S' },
        stage: 'Stage1',
        evolveFrom: 'E',
        abilityFamily: 'evolution',
      });
      const cards = [source, eevee, other, ...fillers(8)];
      const state = fightRun({ deck: cards, hand: [0, 3] });
      const { state: after } = applyAction(state, { type: 'play', uids: [0] }, indexOf(cards));
      expect(after.deck[1]?.cardId).toBe('source');
    });

    it("ne sert qu'une fois par Arène", () => {
      const index = indexOf(deck);
      const state = fightRun({ deck, hand: [0, 2], run: { arenaEvolutionUsed: true } });
      const { state: after } = applyAction(state, { type: 'play', uids: [0] }, index);
      expect(after.deck[1]?.cardId).toBe('base');
    });
  });
});

describe('talents en main', () => {
  it('Agilité : coût de retraite −1 pour toutes les cartes de la main', () => {
    const agile = talent('agility', { retreat: 1 });
    const heavy = card({ id: 'h', retreat: 3 });
    const light = card({ id: 'l', retreat: 0 });
    const deck = [agile, heavy, light];
    const index = indexOf(deck);
    const state = fightRun({ deck, hand: [0, 1, 2] });
    const fight = fightOf(state);
    expect(retreatCost(state, fight, index, 1)).toBe(2);
    expect(retreatCost(state, fight, index, 0)).toBe(0);
    expect(retreatCost(state, fight, index, 2)).toBe(0);
  });

  it('Vision : les 3 prochaines cartes du deck sont visibles', () => {
    const deck = [talent('scout'), ...fillers(6)];
    const index = indexOf(deck);
    const state = fightRun({ deck, hand: [0, 1], drawPile: [2, 3, 4, 5, 6] });
    expect(scoutedCards(state, fightOf(state), index)).toEqual([2, 3, 4]);
  });

  it("Vision : sans la carte en main, rien n'est visible", () => {
    const deck = fillers(6);
    const index = indexOf(deck);
    const state = fightRun({ deck, hand: [0, 1] });
    expect(scoutedCards(state, fightOf(state), index)).toEqual([]);
  });

  it('Échange : une fois par combat, contre la carte du dessus', () => {
    const deck = [talent('switch'), ...fillers(5)];
    const index = indexOf(deck);
    const state = fightRun({ deck, hand: [0, 1], drawPile: [2, 3] });
    const { state: after, events } = applyAction(state, { type: 'swap', uid: 0 }, index);
    expect(events).toContainEqual({ type: 'swapped', uid: 0, drawnUid: 2 });
    expect(fightOf(after).hand).toEqual([1, 2]);
    expect(fightOf(after).drawPile[0]).toBe(0);
    const back = { ...after, fight: { ...fightOf(after), hand: [0, 1], drawPile: [2, 3] } };
    expect(() => applyAction(back, { type: 'swap', uid: 0 }, index)).toThrow();
  });

  it('Échange : refusé pour une carte sans ce talent', () => {
    const deck = fillers(5);
    const index = indexOf(deck);
    const state = fightRun({ deck, hand: [0, 1], drawPile: [2, 3] });
    expect(() => applyAction(state, { type: 'swap', uid: 0 }, index)).toThrow();
  });
});
