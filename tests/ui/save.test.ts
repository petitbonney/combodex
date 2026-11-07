import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { applyAction, createRun, emptyMeta } from '../../src/engine/index.ts';
import { indexOfSet } from '../../src/ui/logic/data.ts';
import { Progress } from '../../src/ui/logic/progress.ts';
import {
  decodeMeta,
  decodeSave,
  encodeSave,
  indexedDbMetaStore,
  indexedDbStore,
  memoryMetaStore,
  memoryStore,
  SAVE_VERSION,
} from '../../src/ui/logic/save.ts';

const cardIndex = indexOfSet('sm12');
const fresh = () => createRun(cardIndex, { seed: 7 });

describe('format de sauvegarde', () => {
  it('rend à l’identique un état sauvegardé', () => {
    const state = applyAction(fresh(), { type: 'startFight' }, cardIndex).state;
    const copy = structuredClone(encodeSave(state, 1));
    expect(decodeSave(copy, indexOfSet)).toEqual(state);
  });

  it('rejoue la suite de la run à l’identique après reprise', () => {
    const state = applyAction(fresh(), { type: 'startFight' }, cardIndex).state;
    const restored = decodeSave(structuredClone(encodeSave(state, 1)), indexOfSet);
    const hand = state.fight?.hand.slice(0, 1) ?? [];
    const original = applyAction(state, { type: 'play', uids: hand }, cardIndex).state;
    const resumed = applyAction(
      restored as typeof state,
      { type: 'play', uids: hand },
      cardIndex,
    ).state;
    expect(resumed).toEqual(original);
  });

  it('refuse une sauvegarde illisible, d’une autre version ou aux cartes inconnues', () => {
    expect(decodeSave(null, indexOfSet)).toBeNull();
    expect(decodeSave('oups', indexOfSet)).toBeNull();
    expect(
      decodeSave({ ...encodeSave(fresh(), 1), version: SAVE_VERSION + 1 }, indexOfSet),
    ).toBeNull();
    const unknown = fresh();
    unknown.deck[0] = { uid: 0, cardId: 'nope', variant: 'normal', energies: [] };
    expect(decodeSave(encodeSave(unknown, 1), indexOfSet)).toBeNull();
  });

  it('refuse une run terminée', () => {
    expect(decodeSave(encodeSave({ ...fresh(), phase: 'lost' }, 1), indexOfSet)).toBeNull();
  });
});

describe.each([
  ['IndexedDB', () => indexedDbStore(new IDBFactory())],
  ['mémoire', () => memoryStore()],
])('stockage %s', (_name, make) => {
  it('écrit, relit, remplace et efface', async () => {
    const store = make();
    expect(await store.read()).toBeFalsy();
    await store.write(encodeSave(fresh(), 1));
    await store.write(encodeSave(fresh(), 2));
    expect(await store.read()).toMatchObject({ savedAt: 2 });
    await store.clear();
    expect(await store.read()).toBeFalsy();
  });
});

describe('IndexedDB', () => {
  it('garde la sauvegarde pour une nouvelle ouverture du jeu', async () => {
    const factory = new IDBFactory();
    await indexedDbStore(factory).write(encodeSave(fresh(), 3));
    expect(await indexedDbStore(factory).read()).toMatchObject({ savedAt: 3 });
  });
});

describe('migration', () => {
  it('reprend une run de la tranche verticale', () => {
    const v1: Record<string, unknown> = { ...fresh() };
    for (const key of ['setId', 'lockedTools', 'dailyDate', 'toolSlots', 'aceSpec']) delete v1[key];
    const restored = decodeSave({ version: 1, savedAt: 1, state: v1 }, indexOfSet);
    expect(restored).toMatchObject({
      setId: 'sm12',
      toolSlots: 5,
      aceSpec: null,
      dailyDate: null,
      arenaCenterUsed: false,
    });
  });
});

describe('progression', () => {
  it('complète une progression incomplète et ignore un contenu illisible', () => {
    expect(decodeMeta('oups')).toEqual(emptyMeta());
    const partial = decodeMeta({ seen: { sm12: ['sm12-1'] } });
    expect(partial.seen.sm12).toEqual(['sm12-1']);
    expect(partial.records.runsWon).toBe(0);
  });

  it('survit à un rechargement, à côté de la sauvegarde de run', async () => {
    const factory = new IDBFactory();
    const meta = { ...emptyMeta(), objectives: ['winRun' as const] };
    await indexedDbMetaStore(factory).write(meta);
    await indexedDbStore(factory).write(encodeSave(fresh(), 1));
    await indexedDbStore(factory).clear();
    expect(await indexedDbMetaStore(factory).read()).toEqual(meta);
  });

  it('prévient d’un objectif atteint et garde les cartes vues', async () => {
    const reached: string[] = [];
    const store = memoryMetaStore();
    const progress = new Progress({ store, onReached: (id) => reached.push(id) });
    await progress.load();
    progress.observe(fresh(), [{ type: 'runWon' }], cardIndex);
    await progress.flush();
    expect(reached).toContain('winRun');
    const again = new Progress({ store });
    await again.load();
    expect(again.current.objectives).toContain('winRun');
    expect(again.current.seen.sm12?.length).toBeGreaterThan(0);
  });
});
