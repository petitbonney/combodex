import { describe, expect, it } from 'vitest';
import type { StatusId } from '../src/content/statuses.ts';
import { STATUS_IDS, STATUSES, statusesOfType } from '../src/content/statuses.ts';
import { POKEMON_TYPES } from '../src/engine/cards.ts';
import { createRng } from '../src/engine/rng.ts';
import { applyStatusRules, currentRules, defaultRules } from '../src/engine/rules.ts';
import { applyAction } from '../src/engine/run.ts';
import { scoreHand } from '../src/engine/scoring.ts';
import type { RunState } from '../src/engine/state.ts';
import {
  card,
  fightRun,
  fillers,
  indexOf,
  instance,
  opponent,
  scoreInput,
  tool,
} from './helpers.ts';

function rulesOf(id: StatusId, strong = false) {
  const rules = defaultRules();
  applyStatusRules(rules, id, strong);
  return rules;
}

const fight = (state: RunState) => {
  if (!state.fight) throw new Error('Pas de combat');
  return state.fight;
};

/**
 * Joue une carte au Tour 1 avec `status` annoncé pour le Tour 2, et renvoie le début du Tour 2.
 * La graine `seed` détermine les jets.
 */
function nextTurnWith(id: StatusId, seed = 1, overrides: { money?: number; tools?: number } = {}) {
  const deck = fillers(20);
  const index = indexOf(deck);
  const start = fightRun({
    deck,
    hand: [0, 1, 2, 3, 4, 5, 6, 7],
    fight: {
      announcedStatus: id,
      opponent: opponent({ hp: 100000, maxHp: 100000, form: 'statuses', type: STATUSES[id].type }),
    },
    tools: Array.from({ length: overrides.tools ?? 0 }, (_, i) => tool(100 + i, 'prism')),
    run: { rng: createRng(seed), money: overrides.money ?? 0 },
  });
  return { index, ...applyAction(start, { type: 'play', uids: [0] }, index) };
}

/** Trouve une graine où le jet réussit, pour tester l'effet. */
function succeeding(id: StatusId, overrides: { money?: number; tools?: number } = {}) {
  for (let seed = 1; seed < 200; seed++) {
    const run = nextTurnWith(id, seed, overrides);
    if (run.events.some((e) => e.type === 'statusRolled' && e.success)) return run;
  }
  throw new Error('Aucun jet réussi');
}

describe('catalogue des statuts', () => {
  it('3 statuts par type, sur les 11 types', () => {
    expect(STATUS_IDS).toHaveLength(33);
    for (const type of POKEMON_TYPES) expect(statusesOfType(type)).toHaveLength(3);
  });

  it('chaque statut a sa version renforcée', () => {
    expect(STATUSES.photosynthesis).toMatchObject({ base: 0.05, strong: 0.1, roll: 'coin' });
    expect(STATUSES.vines).toMatchObject({ base: 7, strong: 6, roll: 'die3' });
    expect(STATUSES.ashes.roll).toBe('die4');
    expect(STATUSES.roots.roll).toBe('none');
  });
});

describe('jets', () => {
  const rate = (id: StatusId) => {
    let success = 0;
    const total = 400;
    for (let seed = 0; seed < total; seed++) {
      const { events } = nextTurnWith(id, seed + 1);
      if (events.some((e) => e.type === 'statusRolled' && e.success)) success += 1;
    }
    return success / total;
  };

  it('pile ou face : 50 %', () => expect(rate('slam')).toBeCloseTo(0.5, 1));
  it('dé 1 à 3 : 50 %', () => expect(rate('howl')).toBeCloseTo(0.5, 1));
  it('dé 1 à 4 : 67 %', () => expect(rate('ashes')).toBeCloseTo(0.67, 1));
  it('aucun jet : toujours appliqué', () => expect(rate('furnace')).toBe(1));

  it("un jet raté ne s'applique pas", () => {
    for (let seed = 1; seed < 50; seed++) {
      const { state, events } = nextTurnWith('slam', seed);
      const rolled = events.find((e) => e.type === 'statusRolled');
      if (rolled && 'success' in rolled && !rolled.success) {
        expect(fight(state).activeStatus).toBeNull();
        return;
      }
    }
    throw new Error('Aucun échec');
  });
});

describe('annonce', () => {
  it('annonce le statut du Tour suivant et applique celui annoncé', () => {
    const { state, events } = nextTurnWith('furnace');
    expect(fight(state).activeStatus?.id).toBe('furnace');
    expect(events.some((e) => e.type === 'statusAnnounced')).toBe(true);
    expect(statusesOfType('Fire')).toContain(fight(state).announcedStatus);
  });

  it('un statut dure un seul Tour', () => {
    const { state, index } = nextTurnWith('furnace');
    const silent = { ...state, fight: { ...fight(state), announcedStatus: null } };
    const hand = fight(state).hand;
    const next = applyAction(silent, { type: 'play', uids: [hand[0] as number] }, index).state;
    expect(fight(next).activeStatus).toBeNull();
  });

  it("n'annonce rien pour un Tour qui n'existe pas", () => {
    const deck = fillers(20);
    const index = indexOf(deck);
    const start = fightRun({
      deck,
      hand: [0, 1, 2, 3, 4, 5, 6, 7],
      fight: {
        turn: 3,
        announcedStatus: 'furnace',
        opponent: opponent({ hp: 100000, maxHp: 100000, form: 'statuses', type: 'Fire' }),
      },
    });
    const { state } = applyAction(start, { type: 'play', uids: [0] }, index);
    expect(fight(state).announcedStatus).toBeNull();
  });

  it("passe en version renforcée à partir de l'Arène 5", () => {
    const deck = fillers(20);
    const index = indexOf(deck);
    const start = fightRun({
      deck,
      hand: [0, 1, 2, 3, 4, 5, 6, 7],
      fight: {
        announcedStatus: 'furnace',
        opponent: opponent({ hp: 100000, maxHp: 100000, form: 'statuses', type: 'Fire' }),
      },
      run: { arenaIndex: 4 },
    });
    const { state } = applyAction(start, { type: 'play', uids: [0] }, index);
    expect(currentRules(fight(state)).damagePenaltyPerCard).toBe(20);
  });
});

describe('statuts sur la main, les PV et les ressources', () => {
  it('Photosynthèse : récupère 5 % des PV max', () => {
    const deck = fillers(20);
    const index = indexOf(deck);
    const start = fightRun({
      deck,
      hand: [0, 1, 2, 3, 4, 5, 6, 7],
      fight: {
        announcedStatus: 'photosynthesis',
        opponent: opponent({ hp: 900, maxHp: 1000, form: 'statuses', type: 'Grass' }),
      },
      run: { rng: createRng(2) },
    });
    for (let seed = 1; seed < 50; seed++) {
      const run = { ...start, rng: createRng(seed) };
      const { events } = applyAction(run, { type: 'play', uids: [0] }, index);
      if (events.some((e) => e.type === 'statusRolled' && e.success)) {
        expect(events).toContainEqual({ type: 'opponentHealed', amount: 50 });
        return;
      }
    }
    throw new Error('Aucun jet réussi');
  });

  it('Photosynthèse : ne dépasse pas les PV max', () => {
    const { events } = succeeding('photosynthesis');
    // Le Tour 1 a retiré 60 PV sur 100 000 : le soin de 5 000 est plafonné.
    expect(events).toContainEqual({ type: 'opponentHealed', amount: 60 });
  });

  it('Racines : coût de retraite +1', () => {
    expect(rulesOf('roots').retreatCostBonus).toBe(1);
    expect(rulesOf('roots', true).retreatCostBonus).toBe(2);
  });

  it('Lianes : main réduite à 7 cartes', () => {
    const { state } = succeeding('vines');
    expect(fight(state).hand).toHaveLength(7);
    expect(rulesOf('vines', true).handLimit).toBe(6);
  });

  it('Brûlure : une carte de la main est défaussée sans coût', () => {
    const { state, events } = succeeding('burn');
    expect(events.some((e) => e.type === 'handBurned')).toBe(true);
    expect(fight(state).discardPile).toHaveLength(1);
    expect(fight(state).hand).toHaveLength(7);
    expect(fight(state).retreatPoints).toBe(4);
  });

  it('Marée : 2 cartes retournent dans le deck et sont remplacées', () => {
    const { state, events } = succeeding('tide');
    const returned = events.find((e) => e.type === 'handReturned');
    expect(returned && 'uids' in returned ? returned.uids : []).toHaveLength(2);
    expect(fight(state).hand).toHaveLength(8);
  });

  it('Courant : −1 point de Retraite pour le reste du combat', () => {
    const { state } = succeeding('current');
    expect(fight(state).retreatPoints).toBe(3);
  });

  it('Paralysie : une carte ne peut pas être jouée', () => {
    const { state, index } = succeeding('paralysis');
    const [uid] = fight(state).paralyzedUids;
    expect(uid).toBeDefined();
    expect(() => applyAction(state, { type: 'play', uids: [uid as number] }, index)).toThrow(
      /paralyzed/,
    );
  });

  it('Hypnose : 2 cartes face cachée pour ce Tour', () => {
    const { state } = succeeding('hypnosis');
    expect(fight(state).hypnotizedUids).toHaveLength(2);
  });

  it('Poison : perd 10 % des Dégâts, cumulable', () => {
    const { state, index } = succeeding('poison');
    expect(fight(state).poisonPercent).toBeCloseTo(0.1);
    const hand = fight(state).hand;
    const withNext = { ...state, fight: { ...fight(state), announcedStatus: 'poison' as const } };
    const next = applyAction(withNext, { type: 'play', uids: [hand[0] as number] }, index).state;
    expect(fight(next).poisonPercent).toBeCloseTo(0.2);
    expect(currentRules(fight(next)).damageLoss).toBeCloseTo(0.2);
  });

  it('Vol : le joueur perd 2 ₽, sans passer sous zéro', () => {
    expect(succeeding('theft', { money: 5 }).state.money).toBe(3);
    expect(succeeding('theft', { money: 1 }).state.money).toBe(0);
  });

  it('Embuscade : un Outil au hasard ne se déclenche pas', () => {
    const { state } = succeeding('ambush', { tools: 2 });
    expect(fight(state).turnDisabledToolUids).toHaveLength(1);
  });

  it('Attraction : une carte de la main doit être jouée', () => {
    const { state, index } = succeeding('attract');
    const [forced] = fight(state).forcedUids;
    const other = fight(state).hand.find((uid) => uid !== forced) as number;
    expect(() => applyAction(state, { type: 'play', uids: [other] }, index)).toThrow(/forcedCard/);
    expect(() => applyAction(state, { type: 'discard', uids: [forced as number] }, index)).toThrow(
      /forcedCard/,
    );
    expect(() =>
      applyAction(state, { type: 'play', uids: [forced as number, other] }, index),
    ).not.toThrow();
  });

  it("Copie : applique un statut d'un autre type", () => {
    const { state, events } = nextTurnWith('mimic');
    const copied = events.find((e) => e.type === 'statusCopied');
    expect(copied).toBeDefined();
    const active = fight(state).activeStatus;
    expect(active?.sourceId).toBe('mimic');
    expect(STATUSES[active?.id as StatusId].type).not.toBe('Colorless');
  });
});

describe('statuts sur le calcul', () => {
  const data = card({ id: 'v', bestDamage: 100 });
  const score = (rules: ReturnType<typeof rulesOf>, cards = [data], overrides = {}) =>
    scoreHand(scoreInput(cards, cards, { rules, ...overrides }));

  it('Fournaise : −10 Dégâts par carte posée', () => {
    const [a, b] = fillers(2, { dexIds: [700], bestDamage: 50 });
    const result = score(rulesOf('furnace'), [a, b] as never);
    expect(result.damage).toBe(120 - 20);
  });

  it('Cendres : plus de +10 Dégâts ; renforcé, plus de type ajouté', () => {
    const energized = instance(1, data, 'normal', ['Water']);
    const base = scoreHand(scoreInput([energized], [data], { rules: rulesOf('ashes') }));
    expect(base.damage).toBe(110);
    const opp = { maxHp: 1000, weaknesses: ['Water' as const], resistances: [] };
    const weak = scoreHand(
      scoreInput([energized], [data], { rules: rulesOf('ashes'), opponent: opp }),
    );
    expect(weak.mult).toBe(2);
    const strong = scoreHand(
      scoreInput([energized], [data], { rules: rulesOf('ashes', true), opponent: opp }),
    );
    expect(strong.mult).toBe(1);
  });

  it('Brume : masque la combinaison ; renforcé, les dégâts aussi', () => {
    expect(rulesOf('mist')).toMatchObject({ hideCombo: true, hideCardDamage: false });
    expect(rulesOf('mist', true)).toMatchObject({ hideCombo: true, hideCardDamage: true });
  });

  it('Surtension : les ×Multi se déclenchent avant les +Multi', () => {
    const tools = [tool(8, 'favoriteArtist'), tool(9, 'campfire', 'Fire')];
    expect(score(rulesOf('overload'), [data], { tools }).mult).toBe(1 * 2 + 4);
    expect(score(defaultRules(), [data], { tools }).mult).toBe((1 + 4) * 2);
  });

  it('Surtension renforcée : ordre aléatoire des Outils', () => {
    expect(rulesOf('overload', true).toolOrder).toBe('random');
    const tools = [tool(8, 'favoriteArtist'), tool(9, 'campfire', 'Fire')];
    const results = new Set<number>();
    for (let seed = 1; seed < 20; seed++) {
      results.add(score(rulesOf('overload', true), [data], { tools, rng: createRng(seed) }).mult);
    }
    expect([...results].sort((a, b) => a - b)).toEqual([6, 10]);
  });

  it('Statique : les cartes à retraite 0 ne marquent pas leurs Dégâts', () => {
    const free = card({ id: 'f', retreat: 0, bestDamage: 80 });
    expect(score(rulesOf('static'), [free]).damage).toBe(10);
    const reverse = instance(1, free, 'reverse');
    const kept = scoreHand(scoreInput([reverse], [free], { rules: rulesOf('static') }));
    expect(kept.damage).toBe(40);
    const lost = scoreHand(scoreInput([reverse], [free], { rules: rulesOf('static', true) }));
    expect(lost.damage).toBe(10);
  });

  it('Confusion : mélange les cartes posées', () => {
    const cards = fillers(5, { dexIds: [701] });
    const orders = new Set<string>();
    for (let seed = 1; seed < 10; seed++) {
      const result = score(rulesOf('confusion'), cards, { rng: createRng(seed) });
      orders.add(result.playedUids.join());
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('Confusion renforcée : une carte posée ne marque rien', () => {
    const cards = fillers(5, { dexIds: [702] });
    const result = score(rulesOf('confusion', true), cards, { rng: createRng(3) });
    expect(result.scoringUids).toHaveLength(4);
  });

  it('Prémonition : −2 Multi sur la combinaison la plus jouée', () => {
    const [a, b] = fillers(2, { dexIds: [703] });
    const counts = { pair: 3, single: 1 };
    const result = score(rulesOf('premonition'), [a, b] as never, { comboCounts: counts });
    expect(result.mult).toBe(1);
    const other = score(rulesOf('premonition'), [data], { comboCounts: counts });
    expect(other.mult).toBe(1);
  });

  it('Intimidation : −2 Multi, sans passer sous 1', () => {
    const [a, b, c] = fillers(3, { dexIds: [704] });
    expect(score(rulesOf('intimidation'), [a, b, c] as never).mult).toBe(1);
    const holo = instance(1, data, 'holo');
    const result = scoreHand(scoreInput([holo], [data], { rules: rulesOf('intimidation') }));
    expect(result.mult).toBe(9);
  });

  it('Garde haute : seules les 4 premières cartes posées marquent', () => {
    const cards = fillers(5, { dexIds: [705] });
    expect(score(rulesOf('highGuard'), cards).scoringUids).toEqual([1, 2, 3, 4]);
    expect(score(rulesOf('highGuard', true), cards).scoringUids).toEqual([1, 2, 3]);
  });

  it('Contre-attaque : sans carte du type faible, −20 % de Dégâts', () => {
    const opp = { maxHp: 1000, weaknesses: ['Water' as const], resistances: [] };
    expect(score(rulesOf('counterAttack'), [data], { opponent: opp }).damage).toBe(88);
    const water = card({ id: 'w', types: ['Water'], bestDamage: 100 });
    expect(score(rulesOf('counterAttack'), [water], { opponent: opp }).damage).toBe(110);
  });

  it('Armure : le Champion absorbe 5 % de ses PV max', () => {
    const opp = { maxHp: 1000, weaknesses: [], resistances: [] };
    expect(score(rulesOf('armor'), [data], { opponent: opp }).score).toBe(110 - 50);
  });

  it('Blindage : la résistance double, ou triple', () => {
    const opp = { maxHp: 1000, weaknesses: [], resistances: ['Fire' as const] };
    expect(score(rulesOf('plating'), [data], { opponent: opp }).damage).toBe(110 - 60);
    expect(score(rulesOf('plating', true), [data], { opponent: opp }).damage).toBe(110 - 90);
  });

  it('Lourdeur : les cartes à retraite 3 ou plus marquent la moitié', () => {
    const heavy = card({ id: 'h', retreat: 3, bestDamage: 100 });
    expect(score(rulesOf('heaviness'), [heavy]).damage).toBe(10 + 50);
    expect(score(rulesOf('heaviness', true), [heavy]).damage).toBe(10 + 25);
  });

  it('Charme : les Outils Collection ne se déclenchent pas', () => {
    const holo = instance(1, data, 'holo');
    const tools = [tool(9, 'rigidBinder')];
    const off = scoreHand(scoreInput([holo], [data], { tools, rules: rulesOf('charm') }));
    expect(off.mult).toBe(11);
    const strong = scoreHand(scoreInput([holo], [data], { tools, rules: rulesOf('charm', true) }));
    expect(strong.mult).toBe(1);
  });

  it('Voile : la première carte posée ne marque rien', () => {
    const cards = fillers(3, { dexIds: [706] });
    expect(score(rulesOf('veil'), cards).scoringUids).toEqual([2, 3]);
    expect(score(rulesOf('veil', true), cards).scoringUids).toEqual([3]);
  });

  it("Écailles : la faiblesse ne s'applique pas", () => {
    const opp = { maxHp: 1000, weaknesses: ['Fire' as const], resistances: [] };
    expect(score(rulesOf('scales'), [data], { opponent: opp }).mult).toBe(1);
    expect(rulesOf('scales', true).weaknessToolsOff).toBe(true);
  });

  it("Fureur : la résistance s'applique à tous les types", () => {
    expect(score(rulesOf('fury'), [data]).damage).toBe(110 - 30);
    expect(score(rulesOf('fury', true), [data]).damage).toBe(110 - 50);
  });

  it("Colère : la combinaison descend d'un rang", () => {
    const cards = fillers(4, { dexIds: [707] });
    const result = score(rulesOf('wrath'), cards);
    expect(result.combo).toBe('quad');
    expect(result.countedCombo).toBe('triple');
    expect(result.mult).toBe(3);
  });

  it('Plaquage : la main perd 15 % de ses Dégâts', () => {
    expect(score(rulesOf('slam'), [data]).damage).toBe(94);
    expect(score(rulesOf('slam', true), [data]).damage).toBe(77);
  });

  it('Hurlement : une carte posée au hasard ne marque rien', () => {
    const cards = fillers(3, { dexIds: [708] });
    const result = score(rulesOf('howl'), cards, { rng: createRng(1) });
    expect(result.scoringUids).toHaveLength(2);
  });
});

describe('effets permanents', () => {
  function bossFight(type: Parameters<typeof opponent>[0], deck = fillers(20)) {
    const index = indexOf(deck);
    const state = fightRun({
      deck,
      fight: { opponent: opponent({ hp: 100000, maxHp: 100000, form: 'permanent', ...type }) },
    });
    return { state, index, rules: currentRules(fight(state)) };
  }

  it('Eau : les cartes Feu ne marquent rien', () => {
    const { rules } = bossFight({ type: 'Water' });
    const data = card({ id: 'f', types: ['Fire'] });
    const result = scoreHand(scoreInput([data], [data], { rules }));
    expect(result.scoringUids).toEqual([]);
  });

  it('Combat : seules les 3 premières cartes posées marquent', () => {
    const { rules } = bossFight({ type: 'Fighting' });
    const cards = fillers(5, { dexIds: [720] });
    const result = scoreHand(scoreInput(cards, cards, { rules }));
    expect(result.scoringUids).toEqual([1, 2, 3]);
  });

  it("Fée : les variantes n'ont aucun effet", () => {
    const { rules } = bossFight({ type: 'Fairy' });
    const data = card({ id: 'v' });
    const result = scoreHand(scoreInput([instance(1, data, 'holo')], [data], { rules }));
    expect(result.mult).toBe(1);
  });

  it("Dragon : la faiblesse ne s'applique pas", () => {
    const { rules } = bossFight({ type: 'Dragon' });
    const data = card({ id: 'v' });
    const result = scoreHand(
      scoreInput([data], [data], {
        rules,
        opponent: { maxHp: 1000, weaknesses: ['Fire'], resistances: [] },
      }),
    );
    expect(result.mult).toBe(1);
  });

  it('Incolore : les Outils liés à un type ne se déclenchent pas', () => {
    const { rules } = bossFight({ type: 'Colorless' });
    const data = card({ id: 'v' });
    const result = scoreHand(
      scoreInput([data], [data], { rules, tools: [tool(9, 'campfire', 'Fire')] }),
    );
    expect(result.mult).toBe(1);
  });

  it('Métal : −50 % sur la combinaison la plus jouée', () => {
    const { rules } = bossFight({ type: 'Metal' });
    const [a, b] = fillers(2, { dexIds: [721], bestDamage: 50 });
    const result = scoreHand(
      scoreInput([a, b] as never, [a, b] as never, { rules, comboCounts: { pair: 2 } }),
    );
    expect(result.damage).toBe(10 + 100);
    expect(result.mult).toBe(1);
  });

  it('Métal : sans main jouée, pas de malus', () => {
    const { rules } = bossFight({ type: 'Metal' });
    const [a, b] = fillers(2, { dexIds: [722] });
    const result = scoreHand(scoreInput([a, b] as never, [a, b] as never, { rules }));
    expect(result.mult).toBe(2);
  });
});
