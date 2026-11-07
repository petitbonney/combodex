import { describe, expect, it } from 'vitest';
import { LOCKABLE_TOOLS, OBJECTIVE_IDS, OBJECTIVES } from '../src/content/objectives.ts';
import { SETS, STARTING_SET } from '../src/content/sets.ts';
import { loadCards } from '../src/data.ts';
import {
  completion,
  dailyChallenge,
  dailyDate,
  emptyMeta,
  isCustomDeckUnlocked,
  isSetUnlocked,
  isSpecialistDeck,
  lockedTools,
  type MetaState,
  objectiveOfSet,
  observeRun,
  unlockedSets,
} from '../src/engine/meta.ts';
import { applyAction, createRun } from '../src/engine/run.ts';
import { decodeRunCode, encodeRunCode } from '../src/engine/run-code.ts';
import { completeLines, validStarterLines } from '../src/engine/starter-deck.ts';
import type { GameEvent, RunState } from '../src/engine/state.ts';

const index = loadCards('sm12');
const run = () => createRun(index, { seed: 3 });

function afterEvents(meta: MetaState, state: RunState, events: GameEvent[] = []) {
  return observeRun(meta, state, events, index);
}

function handEvent(combo: string, score: number): GameEvent {
  return { type: 'handPlayed', result: { combo, score } } as unknown as GameEvent;
}

describe('Classeur', () => {
  it('ajoute les cartes du deck et les Champions de la run', () => {
    const state = run();
    const { meta } = afterEvents(emptyMeta(), state);
    const seen = meta.seen.sm12 ?? [];
    for (const card of state.deck) expect(seen).toContain(card.cardId);
    expect(seen).toContain(state.arenas[0]?.championCardId);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('ajoute les cartes de la boutique et des boosters', () => {
    const state: RunState = {
      ...run(),
      shop: {
        slots: [{ kind: 'card', cardId: 'sm12-5', variant: 'normal', price: 2 }],
        boosters: [],
        consumable: null,
        rerollCost: 5,
      },
      booster: {
        kind: 'set',
        cards: [{ cardId: 'sm12-6', variant: 'normal' }],
        energies: [],
        tools: [],
        keeps: 1,
        free: true,
      },
    };
    const { meta } = afterEvents(emptyMeta(), state);
    expect(meta.seen.sm12).toEqual(expect.arrayContaining(['sm12-5', 'sm12-6']));
  });

  it('calcule le taux de complétion', () => {
    const meta = { ...emptyMeta(), seen: { sm12: index.set.cards.slice(0, 10).map((c) => c.id) } };
    const result = completion(meta, index);
    expect(result).toMatchObject({ seen: 10, total: index.set.cards.length });
  });
});

describe('déblocage des extensions', () => {
  it('ouvre une seule extension au départ', () => {
    expect(unlockedSets(emptyMeta())).toEqual([STARTING_SET]);
  });

  it('prévoit un objectif pour chaque autre extension, dont un au moins caché', () => {
    const others = SETS.filter((set) => set.id !== STARTING_SET);
    const objectives = others.map((set) => objectiveOfSet(set.id));
    for (const id of objectives) expect(id).not.toBeNull();
    expect(objectives.some((id) => id && !OBJECTIVES[id].hidden)).toBe(true);
    expect(objectives.some((id) => id && OBJECTIVES[id].hidden)).toBe(true);
  });

  it('ouvre Soleil et Lune après 4 Champions dans une même run', () => {
    const base = run();
    const state = { ...base, stats: { ...base.stats, championsBeaten: 4 } };
    const { meta, reached } = afterEvents(emptyMeta(), state);
    expect(reached).toContain('fourChampions');
    expect(isSetUnlocked(meta, 'sm1')).toBe(true);
    expect(isSetUnlocked(meta, 'sm2')).toBe(false);
  });

  it('ouvre Gardiens Ascendants après une Lignée monotype', () => {
    const { meta } = afterEvents(emptyMeta(), run(), [handEvent('monoLine', 900)]);
    expect(isSetUnlocked(meta, 'sm2')).toBe(true);
  });

  it("n'annonce un objectif qu'une fois", () => {
    const first = afterEvents(emptyMeta(), run(), [handEvent('monoLine', 900)]);
    const second = afterEvents(first.meta, run(), [handEvent('monoLine', 900)]);
    expect(first.reached).toContain('monoLineHand');
    expect(second.reached).toEqual([]);
  });
});

describe('Outils à débloquer', () => {
  it('verrouille tous les Outils de récompense au départ', () => {
    expect(lockedTools(emptyMeta())).toEqual([...LOCKABLE_TOOLS]);
    expect(LOCKABLE_TOOLS.length).toBeGreaterThanOrEqual(5);
  });

  it('libère le Sablier après une run gagnée', () => {
    const { meta } = afterEvents(emptyMeta(), run(), [{ type: 'runWon' }]);
    expect(lockedTools(meta)).not.toContain('hourglass');
  });

  it("garde les Outils verrouillés hors de la boutique d'une run", () => {
    const locked = [...LOCKABLE_TOOLS];
    const base = createRun(index, { seed: 11, lockedTools: locked });
    let state: RunState = { ...base, phase: 'shop', money: 100000 };
    state.shop = { slots: [], boosters: [], consumable: null, rerollCost: 1 };
    for (let i = 0; i < 150; i++) {
      state = applyAction(state, { type: 'reroll' }, index).state;
      for (const slot of state.shop?.slots ?? []) {
        if (slot?.kind === 'tool') expect(locked).not.toContain(slot.toolId);
      }
    }
  });

  it('couvre tous les objectifs avec une récompense', () => {
    for (const id of OBJECTIVE_IDS) expect(OBJECTIVES[id].reward).toBeDefined();
  });
});

describe('victoire de spécialiste', () => {
  it('compte deux tiers du deck du même type', () => {
    const state = run();
    const grass = index.set.cards.find((card) => card.types[0] === 'Grass')?.id as string;
    const water = index.set.cards.find((card) => card.types[0] === 'Water')?.id as string;
    const deck = state.deck.slice(0, 9).map((card, position) => ({
      ...card,
      cardId: position < 6 ? grass : water,
    }));
    expect(isSpecialistDeck({ ...state, deck }, index)).toBe(true);
    const mixed = deck.map((card, position) => ({
      ...card,
      cardId: position < 5 ? grass : water,
    }));
    expect(isSpecialistDeck({ ...state, deck: mixed }, index)).toBe(false);
  });
});

describe('deck custom', () => {
  const ids = (count: number) => index.set.cards.slice(0, count).map((card) => card.id);

  it('se débloque à 25 % de l’extension', () => {
    const quarter = Math.ceil(index.set.cards.length / 4);
    expect(isCustomDeckUnlocked({ ...emptyMeta(), seen: { sm12: ids(quarter - 1) } }, index)).toBe(
      false,
    );
    expect(isCustomDeckUnlocked({ ...emptyMeta(), seen: { sm12: ids(quarter) } }, index)).toBe(
      true,
    );
  });

  it('construit le deck de départ avec les lignées choisies', () => {
    const lines = completeLines(index);
    const first = lines.findIndex((line) => line.type !== lines[0]?.type);
    const starterLines = [0, first];
    expect(validStarterLines(index, starterLines)).toBe(true);
    const state = createRun(index, { seed: 5, starterLines });
    const names = state.deck.map((card) => index.byId.get(card.cardId)?.name.en);
    expect(names).toContain(lines[0]?.stage2[0]?.name.en);
    expect(names).toContain(lines[first]?.stage2[0]?.name.en);
    expect(state.deck).toHaveLength(20);
  });

  it('refuse deux lignées du même type', () => {
    const lines = completeLines(index);
    const twin = lines.findIndex((line, at) => at > 0 && line.type === lines[0]?.type);
    if (twin > 0) expect(validStarterLines(index, [0, twin])).toBe(false);
    expect(validStarterLines(index, [0])).toBe(false);
    expect(validStarterLines(index, [0, 99])).toBe(false);
  });
});

describe('défi du jour', () => {
  it('donne le même défi à tous pour une même date', () => {
    expect(dailyChallenge('2026-11-07')).toEqual(dailyChallenge('2026-11-07'));
    expect(dailyChallenge('2026-11-07').seed).not.toBe(dailyChallenge('2026-11-08').seed);
  });

  it('fait tourner les 3 extensions', () => {
    const sets = new Set(
      ['2026-11-07', '2026-11-08', '2026-11-09'].map((date) => dailyChallenge(date).setId),
    );
    expect(sets.size).toBe(3);
  });

  it('prend le jour UTC', () => {
    expect(dailyDate(Date.UTC(2026, 10, 7, 23, 59))).toBe('2026-11-07');
  });

  it('garde la meilleure main du jour', () => {
    const base = createRun(index, { seed: 1, dailyDate: '2026-11-07' });
    const state = { ...base, stats: { ...base.stats, bestHand: 500 } };
    const { meta } = afterEvents(emptyMeta(), state);
    expect(meta.daily['2026-11-07']).toBe(500);
    const worse = { ...state, stats: { ...state.stats, bestHand: 100 } };
    expect(afterEvents(meta, worse).meta.daily['2026-11-07']).toBe(500);
  });

  it('ne note rien hors défi', () => {
    expect(afterEvents(emptyMeta(), run()).meta.daily).toEqual({});
  });
});

describe('codes de run', () => {
  const code = {
    setId: 'sm2',
    seed: 4021987654,
    lockedTools: [LOCKABLE_TOOLS[0], LOCKABLE_TOOLS[3]].filter((tool) => tool !== undefined),
    starterLines: [2, 7],
  };

  it('tient en 12 caractères et se relit à l’identique', () => {
    const text = encodeRunCode(code);
    expect(text).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(decodeRunCode(text)).toEqual(code);
  });

  it('accepte les minuscules et les espaces', () => {
    const text = encodeRunCode(code).toLowerCase().replaceAll('-', ' ');
    expect(decodeRunCode(text)).toEqual(code);
  });

  it('marche sans deck custom', () => {
    const plain = { ...code, starterLines: null };
    expect(decodeRunCode(encodeRunCode(plain))).toEqual(plain);
  });

  it('refuse un texte qui n’est pas un code', () => {
    expect(decodeRunCode('bonjour')).toBeNull();
    expect(decodeRunCode('')).toBeNull();
  });

  it('refuse un code mal recopié', () => {
    const text = encodeRunCode(code);
    const last = text.at(-1) === '0' ? '1' : '0';
    expect(decodeRunCode(`${text.slice(0, -1)}${last}`)).toBeNull();
  });

  it('rejoue la même run depuis son code', () => {
    const first = createRun(index, { seed: 77, lockedTools: [...LOCKABLE_TOOLS] });
    const decoded = decodeRunCode(
      encodeRunCode({
        setId: first.setId,
        seed: first.seed,
        lockedTools: first.lockedTools,
        starterLines: first.starterLines,
      }),
    );
    if (!decoded) throw new Error('Code illisible');
    expect(createRun(index, decoded)).toEqual(first);
  });
});
