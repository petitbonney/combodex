import { describe, expect, it } from 'vitest';
import { LEAGUE_HP } from '../src/content/balance.ts';
import { STATUS_IDS } from '../src/content/statuses.ts';
import { loadCards } from '../src/data.ts';
import { permanentType } from '../src/engine/rules.ts';
import { applyAction, createRun } from '../src/engine/run.ts';
import type { RunState } from '../src/engine/state.ts';

const index = loadCards('sm12');

/** Une run arrêtée juste avant la Ligue. */
function atLeague(seed: number): RunState {
  const run = createRun(index, { seed });
  return { ...run, arenaIndex: run.arenas.length - 1, stageIndex: 2 };
}

function league(seed: number) {
  const { state, events } = applyAction(atLeague(seed), { type: 'startFight' }, index);
  if (!state.fight) throw new Error('Combat manquant');
  return { state, fight: state.fight, events };
}

describe('Maître de la Ligue', () => {
  it('a 150 000 PV et une vraie carte de gros PV', () => {
    const { fight } = league(4);
    expect(fight.opponent.kind).toBe('league');
    expect(fight.opponent.maxHp).toBe(LEAGUE_HP);
    const biggest = Math.max(...index.set.cards.map((card) => card.hp));
    expect(index.byId.get(fight.opponent.cardId)?.hp).toBeGreaterThanOrEqual(biggest - 100);
  });

  it("emprunte l'effet permanent d'une Arène de la run", () => {
    const { state, fight } = league(4);
    const types = state.arenas.slice(0, -1).map((arena) => arena.type);
    expect(types).toContain(permanentType(fight.opponent));
  });

  it('annonce ses statuts parmi tous les types', () => {
    const drawn = new Set(
      Array.from({ length: 60 }, (_, seed) => league(seed + 1).fight.announcedStatus),
    );
    for (const id of drawn) expect(STATUS_IDS).toContain(id);
    expect(drawn.size).toBeGreaterThan(11);
  });

  it('change de faiblesse à chaque Tour', () => {
    const { state, fight, events } = league(7);
    expect(events.some((event) => event.type === 'weaknessChanged')).toBe(true);
    expect(fight.opponent.weaknesses).toHaveLength(1);
    const uid = fight.hand[0] as number;
    const next = applyAction(state, { type: 'play', uids: [uid] }, index);
    expect(next.events.some((event) => event.type === 'weaknessChanged')).toBe(true);
  });

  it('ne se passe pas', () => {
    expect(() => applyAction(atLeague(1), { type: 'skipFight' }, index)).toThrow();
  });

  it('vient juste après la boutique du 8e Champion, sans Dresseur', () => {
    const run = createRun(index, { seed: 3 });
    const before: RunState = {
      ...run,
      arenaIndex: 7,
      stageIndex: 2,
      phase: 'shop',
      shop: { slots: [], boosters: [], consumable: null, rerollCost: 5 },
    };
    const { state } = applyAction(before, { type: 'leaveShop' }, index);
    expect(state.arenaIndex).toBe(8);
    expect(state.stageIndex).toBe(2);
    expect(state.arenas[state.arenaIndex]?.league).toBe(true);
  });

  it('gagner la Ligue termine la run', () => {
    const { state, fight } = league(5);
    fight.opponent.hp = 1;
    fight.activeStatus = null;
    const uid = fight.hand[0] as number;
    const { state: after, events } = applyAction(state, { type: 'play', uids: [uid] }, index);
    expect(after.phase).toBe('won');
    expect(after.stats.championsBeaten).toBe(1);
    expect(events).toContainEqual({ type: 'runWon' });
  });
});
