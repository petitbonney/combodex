import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng.ts';
import { scoreHand } from '../src/engine/scoring.ts';
import { card, fillers, instance, scoreInput, tool } from './helpers.ts';

/** Lignée monotype Feu de l'exemple chiffré du game design. */
function fireLine() {
  const base = card({ id: 'base', name: { fr: 'A', en: 'A' }, bestDamage: 30 });
  const middle = card({
    id: 'middle',
    name: { fr: 'B', en: 'B' },
    stage: 'Stage1',
    evolveFrom: 'A',
    bestDamage: 60,
  });
  const top = card({
    id: 'top',
    name: { fr: 'C', en: 'C' },
    stage: 'Stage2',
    evolveFrom: 'B',
    bestDamage: 150,
  });
  const extra1 = card({ id: 'e1', bestDamage: 40 });
  const extra2 = card({ id: 'e2', bestDamage: 50 });
  return { cards: [base, middle, top, extra1, extra2], base, middle, top, extra1, extra2 };
}

describe('exemple chiffré du game design', () => {
  it('Lignée monotype Feu contre un Champion faible au Feu : 40 280', () => {
    const { cards, base, middle, top, extra1, extra2 } = fireLine();
    const result = scoreHand(
      scoreInput(
        [
          instance(1, base),
          instance(2, middle),
          instance(3, top, 'holo'),
          instance(4, extra1),
          instance(5, extra2),
        ],
        cards,
        {
          tools: [tool(10, 'campfire', 'Fire')],
          opponent: { maxHp: 40000, weaknesses: ['Fire'], resistances: [] },
        },
      ),
    );
    expect(result.combo).toBe('monoLine');
    expect(result.damage).toBe(530);
    expect(result.mult).toBe(76);
    expect(result.score).toBe(40280);
  });
});

describe('dégâts des cartes', () => {
  it('ne compte que les cartes qui forment la combinaison', () => {
    const [a, b] = fillers(2, { dexIds: [900], bestDamage: 40 });
    const other = card({ id: 'o', bestDamage: 200 });
    const result = scoreHand(scoreInput([a, b, other] as never, [a, b, other] as never));
    expect(result.combo).toBe('pair');
    expect(result.damage).toBe(20 + 40 + 40);
    expect(result.score).toBe(100 * 2);
  });

  it("une TAG TEAM ne compte ses dégâts qu'une fois", () => {
    const tag = card({ id: 'tag', dexIds: [1, 2], isTagTeam: true, bestDamage: 100 });
    const partner = card({ id: 'p', dexIds: [1], bestDamage: 50 });
    const result = scoreHand(scoreInput([tag, partner], [tag, partner]));
    expect(result.damage).toBe(20 + 100 + 50);
  });
});

describe('variantes', () => {
  const data = card({ id: 'v', bestDamage: 50 });

  it('Normale : aucun effet', () => {
    expect(scoreHand(scoreInput([instance(1, data)], [data])).score).toBe(60);
  });

  it('Reverse : +30 Dégâts', () => {
    const result = scoreHand(scoreInput([instance(1, data, 'reverse')], [data]));
    expect(result.damage).toBe(90);
  });

  it('Holo : +10 Multi', () => {
    const result = scoreHand(scoreInput([instance(1, data, 'holo')], [data]));
    expect(result.mult).toBe(11);
  });

  it('1re édition : ×1,5 Multi après les +Multi', () => {
    const result = scoreHand(
      scoreInput([instance(1, data, 'firstEdition')], [data], {
        tools: [tool(9, 'campfire', 'Fire')],
      }),
    );
    expect(result.mult).toBe((1 + 4) * 1.5);
  });
});

describe('énergies attachées', () => {
  const data = card({ id: 'v', bestDamage: 50 });

  it('ajoutent +10 Dégâts chacune', () => {
    const result = scoreHand(scoreInput([instance(1, data, 'normal', ['Water', 'Metal'])], [data]));
    expect(result.damage).toBe(10 + 50 + 20);
  });

  it('ajoutent leur type pour la faiblesse', () => {
    const result = scoreHand(
      scoreInput([instance(1, data, 'normal', ['Water'])], [data], {
        opponent: { maxHp: 1000, weaknesses: ['Water'], resistances: [] },
      }),
    );
    expect(result.mult).toBe(2);
  });
});

describe('ordre de résolution', () => {
  it("applique tous les +Multi avant les ×Multi, quel que soit l'ordre des Outils", () => {
    const data = card({ id: 'v', bestDamage: 50 });
    const held = instance(1, data, 'holo');
    const binderFirst = [tool(8, 'rigidBinder'), tool(9, 'campfire', 'Fire')];
    const result = scoreHand(scoreInput([held], [data], { tools: binderFirst }));
    // (1 + 10 + 4) × 1,5
    expect(result.mult).toBe(22.5);
  });

  it('déclenche les cartes de gauche à droite, puis les Outils', () => {
    const [a, b] = fillers(2, { dexIds: [901] });
    const result = scoreHand(
      scoreInput([a, b] as never, [a, b] as never, { tools: [tool(9, 'campfire', 'Fire')] }),
    );
    expect(result.steps.map((step) => step.kind)).toEqual(['combo', 'card', 'card', 'tool']);
    expect(result.steps.slice(1, 3).map((step) => 'uid' in step && step.uid)).toEqual([1, 2]);
  });

  it('applique la faiblesse après les Outils', () => {
    const data = card({ id: 'v' });
    const result = scoreHand(
      scoreInput([data], [data], {
        tools: [tool(9, 'campfire', 'Fire')],
        opponent: { maxHp: 1000, weaknesses: ['Fire'], resistances: [] },
      }),
    );
    expect(result.mult).toBe((1 + 4) * 2);
    expect(result.steps.at(-1)?.kind).toBe('weakness');
  });
});

describe('faiblesse et résistance', () => {
  it('une seule carte du type faible suffit, même si elle ne marque pas', () => {
    const [a, b] = fillers(2, { dexIds: [902], types: ['Water'] });
    const fire = card({ id: 'f', types: ['Fire'] });
    const result = scoreHand(
      scoreInput([a, b, fire] as never, [a, b, fire] as never, {
        opponent: { maxHp: 1000, weaknesses: ['Fire'], resistances: [] },
      }),
    );
    expect(result.mult).toBe(4);
  });

  it('la résistance retire 30 Dégâts par carte du type résisté', () => {
    const [a, b] = fillers(2, { dexIds: [903], types: ['Fire'], bestDamage: 50 });
    const result = scoreHand(
      scoreInput([a, b] as never, [a, b] as never, {
        opponent: { maxHp: 1000, weaknesses: [], resistances: ['Fire'] },
      }),
    );
    expect(result.damage).toBe(20 + 100 - 60);
  });

  it('les Dégâts ne descendent pas sous zéro', () => {
    const data = card({ id: 'f', bestDamage: 10, types: ['Fire'] });
    const result = scoreHand(
      scoreInput([data], [data], {
        opponent: { maxHp: 1000, weaknesses: [], resistances: ['Fire'] },
        rules: { resistanceFactor: 3 },
      }),
    );
    expect(result.damage).toBe(0);
    expect(result.score).toBe(0);
  });
});

describe('estimation', () => {
  it("sans générateur, aucun jet n'est fait et le calcul reste stable", () => {
    const data = card({ id: 'v', abilityFamily: 'coinFlip' });
    const input = scoreInput([data], [data]);
    expect(scoreHand(input).mult).toBe(1);
    expect(scoreHand(input)).toEqual(scoreHand(input));
  });

  it('avec une graine, le calcul est reproductible', () => {
    const data = card({ id: 'v', abilityFamily: 'coinFlip' });
    const run = (seed: number) =>
      scoreHand(scoreInput([data], [data], { rng: createRng(seed) })).mult;
    expect(run(5)).toBe(run(5));
  });
});

describe('totaux pas à pas pour les animations', () => {
  it('donne les Dégâts et le Multi après chaque étape, et finit sur le résultat', () => {
    const [a, b] = fillers(2, { dexIds: [930], types: ['Fire'], bestDamage: 40 });
    const holo = instance(1, a as never, 'holo');
    const plain = instance(2, b as never);
    const result = scoreHand(
      scoreInput([holo, plain], [a, b] as never, { tools: [tool(9, 'campfire', 'Fire')] }),
    );
    expect(result.running).toHaveLength(result.steps.length);
    expect(result.running[0]).toEqual({ damage: 20, mult: 2 });
    expect(result.running.at(-1)).toEqual({ damage: result.damage, mult: result.mult });
  });

  it("montre le ×Multi d'une 1re édition à part, avant les ×Multi des Outils", () => {
    const first = card({ id: 'first', bestDamage: 30 });
    const result = scoreHand(
      scoreInput([instance(1, first, 'firstEdition')], [first], {
        tools: [tool(9, 'badgeCase')],
        fightsWon: 10,
      }),
    );
    const kinds = result.steps.map((step) => step.kind);
    expect(kinds).toEqual(['combo', 'card', 'cardTimes', 'tool']);
    expect(result.running[2]?.mult).toBeCloseTo(1.5);
    expect(result.running[3]?.mult).toBeCloseTo(3);
  });
});
