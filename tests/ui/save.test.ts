import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { applyAction, createRun } from '../../src/engine/index.ts';
import { cardIndex } from '../../src/ui/logic/data.ts';
import {
  decodeSave,
  encodeSave,
  indexedDbStore,
  memoryStore,
  SAVE_VERSION,
} from '../../src/ui/logic/save.ts';

const fresh = () => createRun(cardIndex, { seed: 7 });

describe('format de sauvegarde', () => {
  it('rend à l’identique un état sauvegardé', () => {
    const state = applyAction(fresh(), { type: 'startFight' }, cardIndex).state;
    const copy = structuredClone(encodeSave(state, 1));
    expect(decodeSave(copy, cardIndex)).toEqual(state);
  });

  it('rejoue la suite de la run à l’identique après reprise', () => {
    const state = applyAction(fresh(), { type: 'startFight' }, cardIndex).state;
    const restored = decodeSave(structuredClone(encodeSave(state, 1)), cardIndex);
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
    expect(decodeSave(null, cardIndex)).toBeNull();
    expect(decodeSave('oups', cardIndex)).toBeNull();
    expect(
      decodeSave({ ...encodeSave(fresh(), 1), version: SAVE_VERSION + 1 }, cardIndex),
    ).toBeNull();
    const unknown = fresh();
    unknown.deck[0] = { uid: 0, cardId: 'nope', variant: 'normal', energies: [] };
    expect(decodeSave(encodeSave(unknown, 1), cardIndex)).toBeNull();
  });

  it('refuse une run terminée', () => {
    expect(decodeSave(encodeSave({ ...fresh(), phase: 'lost' }, 1), cardIndex)).toBeNull();
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
