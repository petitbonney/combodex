import { describe, expect, it } from 'vitest';
import { COMBO_IDS, COMBO_VALUES, demoteCombo, detectCombo } from '../src/engine/combos.ts';
import { card, comboCard, fillers } from './helpers.ts';

const withDex = (dexId: number, id: string, overrides = {}) =>
  card({ id, dexIds: [dexId], ...overrides });
const types = ['Fire', 'Water', 'Grass', 'Psychic', 'Metal', 'Fairy'] as const;

function detect(cards: ReturnType<typeof card>[]) {
  return detectCombo(cards.map((data) => comboCard(data)));
}

function line(type: 'Fire' | 'Water' = 'Fire') {
  return [
    card({ id: 'a', name: { fr: 'A', en: 'A' }, stage: 'Basic', types: [type] }),
    card({ id: 'b', name: { fr: 'B', en: 'B' }, stage: 'Stage1', evolveFrom: 'A', types: [type] }),
    card({ id: 'c', name: { fr: 'C', en: 'C' }, stage: 'Stage2', evolveFrom: 'B', types: [type] }),
  ];
}

describe('valeurs des combinaisons', () => {
  it('reprend le tableau du game design', () => {
    expect(COMBO_IDS.map((id) => [COMBO_VALUES[id].damage, COMBO_VALUES[id].mult])).toEqual([
      [10, 1],
      [20, 2],
      [50, 3],
      [60, 4],
      [70, 4],
      [80, 4],
      [80, 4],
      [120, 7],
      [200, 8],
      [300, 12],
    ]);
  });
});

describe('détection des combinaisons', () => {
  it('Carte seule : seule la carte la plus forte marque', () => {
    const cards = [
      card({ id: 'x', types: ['Fire'], bestDamage: 30 }),
      card({ id: 'y', types: ['Water'], bestDamage: 90 }),
      card({ id: 'z', types: ['Grass'], bestDamage: 60 }),
    ];
    expect(detect(cards)).toEqual({ combo: 'single', scoring: [1] });
  });

  it('Paire : 2 fois le même Pokémon, les autres cartes ne marquent pas', () => {
    const cards = [withDex(1, 'a'), withDex(2, 'b'), withDex(1, 'c')];
    expect(detect(cards)).toEqual({ combo: 'pair', scoring: [0, 2] });
  });

  it('Brelan : 3 fois le même Pokémon', () => {
    const cards = [withDex(1, 'a'), withDex(1, 'b'), withDex(1, 'c'), withDex(4, 'd')];
    expect(detect(cards)).toEqual({ combo: 'triple', scoring: [0, 1, 2] });
  });

  it('Famille : Brelan + Paire', () => {
    const cards = [
      withDex(1, 'a'),
      withDex(2, 'b'),
      withDex(1, 'c'),
      withDex(2, 'd'),
      withDex(1, 'e'),
    ];
    expect(detect(cards)).toEqual({ combo: 'family', scoring: [0, 1, 2, 3, 4] });
  });

  it('Carré : 4 fois le même Pokémon', () => {
    const cards = [1, 1, 1, 1, 2].map((dex, i) => withDex(dex, `c${i}`));
    expect(detect(cards)).toEqual({ combo: 'quad', scoring: [0, 1, 2, 3] });
  });

  it('Quinte : 5 fois le même Pokémon', () => {
    const cards = [1, 1, 1, 1, 1].map((dex, i) => withDex(dex, `c${i}`));
    expect(detect(cards).combo).toBe('quint');
  });

  it('Arc-en-ciel : 5 types différents', () => {
    const cards = types.slice(0, 5).map((type, i) => card({ id: `c${i}`, types: [type] }));
    expect(detect(cards)).toEqual({ combo: 'rainbow', scoring: [0, 1, 2, 3, 4] });
  });

  it("4 types ne font pas d'Arc-en-ciel", () => {
    const cards = ['Fire', 'Water', 'Grass', 'Metal', 'Metal'].map((type, i) =>
      card({ id: `c${i}`, types: [type as 'Fire'] }),
    );
    expect(detect(cards).combo).toBe('single');
  });

  it('Monotype : 5 Pokémon du même type', () => {
    expect(detect(fillers(5, { types: ['Water'] })).combo).toBe('monotype');
    expect(detect(fillers(4, { types: ['Water'] })).combo).toBe('single');
  });

  it('Lignée : Base + Niveau 1 + Niveau 2 de la même évolution', () => {
    const cards = [...line(), card({ id: 'o', types: ['Water'] })];
    expect(detect(cards)).toEqual({ combo: 'line', scoring: [0, 1, 2] });
  });

  it("Pas de Lignée si la chaîne d'évolution est rompue", () => {
    const [a, b] = line();
    const stranger = card({ id: 'z', stage: 'Stage2', evolveFrom: 'Inconnu' });
    expect(detect([a, b, stranger] as never).combo).toBe('single');
  });

  it('Lignée monotype : Lignée + 5 Pokémon du même type', () => {
    const cards = [...line(), ...fillers(2, { types: ['Fire'] })];
    expect(detect(cards)).toEqual({ combo: 'monoLine', scoring: [0, 1, 2, 3, 4] });
  });

  it('Une Lignée de type mêlé reste une Lignée', () => {
    const cards = [...line(), ...fillers(2, { types: ['Water'] })];
    expect(detect(cards).combo).toBe('line');
  });

  it('choisit la meilleure : un Carré de même type reste un Carré sans 5e carte', () => {
    const cards = [1, 1, 1, 1].map((dex, i) => withDex(dex, `c${i}`, { types: ['Fire'] }));
    expect(detect(cards).combo).toBe('quad');
  });

  it('préfère la Quinte à la Lignée monotype et au Monotype', () => {
    const cards = [1, 1, 1, 1, 1].map((dex, i) => withDex(dex, `c${i}`, { types: ['Fire'] }));
    expect(detect(cards).combo).toBe('quint');
  });

  it('choisit la paire la plus forte quand il y en a deux', () => {
    const cards = [
      withDex(1, 'a', { bestDamage: 10 }),
      withDex(1, 'b', { bestDamage: 10 }),
      withDex(2, 'c', { bestDamage: 90 }),
      withDex(2, 'd', { bestDamage: 90 }),
    ];
    expect(detect(cards)).toEqual({ combo: 'pair', scoring: [2, 3] });
  });
});

describe('règle TAG TEAM', () => {
  const tag = (dexIds: number[], overrides = {}) =>
    card({ id: `tag-${dexIds.join('-')}`, dexIds, isTagTeam: true, ...overrides });

  it('compte comme chacun de ses Pokémon pour les Paires', () => {
    const cards = [tag([1, 2]), withDex(2, 'b')];
    expect(detect(cards)).toEqual({ combo: 'pair', scoring: [0, 1] });
  });

  it('forme une Famille en 4 cartes : le TAG TEAM compte dans les deux groupes', () => {
    const cards = [tag([1, 2]), withDex(1, 'a'), withDex(1, 'b'), withDex(2, 'c')];
    expect(detect(cards)).toEqual({ combo: 'family', scoring: [0, 1, 2, 3] });
  });

  it('compte 2 Pokémon pour le Monotype : 4 cartes suffisent', () => {
    const cards = [tag([1, 2], { types: ['Fire'] }), ...fillers(3, { types: ['Fire'] })];
    expect(detect(cards).combo).toBe('monotype');
  });

  it('compte 3 Pokémon pour un TAG TEAM triple', () => {
    const cards = [tag([1, 2, 3], { types: ['Fire'] }), ...fillers(2, { types: ['Fire'] })];
    expect(detect(cards).combo).toBe('monotype');
  });

  it("n'apporte qu'un type à l'Arc-en-ciel s'il n'en a qu'un", () => {
    const cards = [
      tag([1, 2], { types: ['Fire'] }),
      ...['Water', 'Grass', 'Psychic'].map((type, i) =>
        card({ id: `c${i}`, types: [type as 'Fire'] }),
      ),
    ];
    expect(detect(cards).combo).toBe('single');
  });

  it("apporte deux types à l'Arc-en-ciel avec une énergie", () => {
    const data = tag([1, 2], { types: ['Fire'] });
    const others = ['Water', 'Grass', 'Psychic'].map((type, i) =>
      card({ id: `c${i}`, types: [type as 'Fire'] }),
    );
    const detected = detectCombo([
      comboCard(data, { types: ['Fire', 'Metal'] }),
      ...others.map((other) => comboCard(other)),
    ]);
    expect(detected.combo).toBe('rainbow');
  });
});

describe('types effectifs', () => {
  it('une énergie rend la carte double type pour le Monotype', () => {
    const fire = fillers(4, { types: ['Fire'] });
    const water = card({ id: 'w', types: ['Water'] });
    const detected = detectCombo([
      ...fire.map((data) => comboCard(data)),
      comboCard(water, { types: ['Water', 'Fire'] }),
    ]);
    expect(detected.combo).toBe('monotype');
  });

  it("une double type peut combler le trou d'un Arc-en-ciel", () => {
    const cards = ['Fire', 'Water', 'Grass', 'Psychic'].map((type, i) =>
      comboCard(card({ id: `c${i}`, types: [type as 'Fire'] })),
    );
    const doubled = comboCard(card({ id: 'd', types: ['Fire'] }), { types: ['Fire', 'Metal'] });
    expect(detectCombo([...cards, doubled]).combo).toBe('rainbow');
  });

  it('une carte joker complète un Monotype', () => {
    const cards = fillers(4, { types: ['Fire'] }).map((data) => comboCard(data));
    const joker = comboCard(card({ id: 'j', types: ['Colorless'] }), { wildcard: true });
    expect(detectCombo([...cards, joker]).combo).toBe('monotype');
  });
});

describe('six cartes (Grand banc)', () => {
  it('la 6e marque si elle entre dans la combinaison', () => {
    const cards = [1, 1, 1, 1, 1, 1].map((dex, i) => withDex(dex, `c${i}`));
    expect(detect(cards).scoring).toHaveLength(6);
  });

  it('la 6e ne marque pas si elle reste hors de la combinaison', () => {
    const cards = [1, 1, 1, 1, 1, 2].map((dex, i) => withDex(dex, `c${i}`));
    expect(detect(cards).scoring).toEqual([0, 1, 2, 3, 4]);
  });

  it('un Arc-en-ciel à 6 types fait marquer les 6 cartes', () => {
    const cards = types.map((type, i) => card({ id: `c${i}`, types: [type] }));
    expect(detect(cards).scoring).toHaveLength(6);
  });

  it('un Monotype à 6 cartes les fait toutes marquer', () => {
    expect(detect(fillers(6, { types: ['Fire'] })).scoring).toHaveLength(6);
  });
});

describe('descente de rang (Colère)', () => {
  it('Carré compté comme Brelan, comme dans le game design', () => {
    expect(demoteCombo('quad', 1)).toBe('triple');
  });

  it('descend de deux rangs en version renforcée', () => {
    expect(demoteCombo('quad', 2)).toBe('pair');
    expect(demoteCombo('quint', 2)).toBe('triple');
    expect(demoteCombo('monoLine', 2)).toBe('triple');
  });

  it("s'arrête à Carte seule", () => {
    expect(demoteCombo('pair', 2)).toBe('single');
  });
});
