import { describe, expect, it } from 'vitest';
import { moveItem, sortHand, syncOrder, toggleSelection } from '../../src/ui/logic/hand.ts';
import { card, fightRun, indexOf } from '../helpers.ts';

describe('ordre de la main', () => {
  it("garde l'ordre choisi et ajoute les cartes piochées à droite", () => {
    expect(syncOrder([3, 1, 2], [1, 2, 3, 4])).toEqual([3, 1, 2, 4]);
    expect(syncOrder([3, 1, 2], [2, 5])).toEqual([2, 5]);
  });

  it('déplace un élément', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });
});

describe('sélection', () => {
  it('ajoute dans l’ordre du toucher et retire au second toucher', () => {
    expect(toggleSelection([4], 2, 5)).toEqual([4, 2]);
    expect(toggleSelection([4, 2], 4, 5)).toEqual([2]);
  });

  it('ne dépasse pas le nombre de cartes posables', () => {
    expect(toggleSelection([1, 2], 3, 2)).toEqual([1, 2]);
  });
});

describe('tri', () => {
  const base = card({ id: 'base', name: { fr: 'Base', en: 'Base' }, types: ['Water'] });
  const mid = card({
    id: 'mid',
    name: { fr: 'Mid', en: 'Mid' },
    stage: 'Stage1',
    evolveFrom: 'Base',
    types: ['Water'],
  });
  const fire = card({ id: 'fire', name: { fr: 'Zed', en: 'Zed' }, types: ['Fire'] });
  const grass = card({ id: 'grass', name: { fr: 'Abc', en: 'Abc' }, types: ['Grass'] });
  const cards = [mid, fire, base, grass];
  const state = fightRun({ deck: cards });
  const index = indexOf(cards);
  const none = () => false;

  it('range par type dans l’ordre du jeu', () => {
    expect(sortHand([0, 1, 2, 3], state, index, 'type', none)).toEqual([3, 1, 2, 0]);
  });

  it('rapproche une lignée, de la Base vers ses évolutions', () => {
    const sorted = sortHand([0, 1, 2, 3], state, index, 'line', none);
    expect(sorted.indexOf(2) + 1).toBe(sorted.indexOf(0));
  });

  it('laisse les cartes cachées à droite, sans les ranger', () => {
    const hidden = (uid: number) => uid === 1 || uid === 3;
    expect(sortHand([1, 3, 0, 2], state, index, 'type', hidden).slice(2)).toEqual([1, 3]);
  });
});
