import { describe, expect, it } from 'vitest';
import { TOOL_IDS, TOOL_OFFERS, TOOLS } from '../src/content/tools.ts';
import { scoreHand } from '../src/engine/scoring.ts';
import { card, fillers, instance, scoreInput, tool } from './helpers.ts';

describe('catalogue', () => {
  it('propose 20 Outils, dont un Feu de camp par type, soit 30 offres', () => {
    expect(TOOL_IDS).toHaveLength(20);
    expect(TOOL_OFFERS.filter((offer) => offer.toolId === 'campfire')).toHaveLength(11);
    expect(TOOL_OFFERS).toHaveLength(30);
  });

  it('respecte les raretés du game design', () => {
    expect(TOOLS.campfire.rarity).toBe('common');
    expect(TOOLS.colossus.rarity).toBe('uncommon');
    expect(TOOLS.bigBench.rarity).toBe('rare');
    expect(TOOLS.marketValue.rarity).toBe('legendary');
  });
});

describe('Feu de camp', () => {
  it('+4 Multi par carte de ce type jouée, même hors combinaison', () => {
    const [a, b] = fillers(2, { dexIds: [910], types: ['Fire'] });
    const other = card({ id: 'o', types: ['Fire'] });
    const water = card({ id: 'w', types: ['Water'] });
    const result = scoreHand(
      scoreInput([a, b, other, water] as never, [a, b, other, water] as never, {
        tools: [tool(9, 'campfire', 'Fire')],
      }),
    );
    expect(result.mult).toBe(2 + 12);
  });

  it('compte le type apporté par une énergie', () => {
    const water = card({ id: 'w', types: ['Water'] });
    const result = scoreHand(
      scoreInput([instance(1, water, 'normal', ['Fire'])], [water], {
        tools: [tool(9, 'campfire', 'Fire')],
      }),
    );
    expect(result.mult).toBe(5);
  });
});

describe('Colosse', () => {
  it('toutes les cartes qui marquent comptent leurs PV', () => {
    const [a, b] = fillers(2, { dexIds: [911], hp: 180, bestDamage: 10 });
    const result = scoreHand(
      scoreInput([a, b] as never, [a, b] as never, { tools: [tool(9, 'colossus')] }),
    );
    expect(result.damage).toBe(20 + 180 + 180);
  });

  it('pour une Carte seule, retient la carte aux plus gros PV', () => {
    const small = card({ id: 's', types: ['Fire'], hp: 60, bestDamage: 100 });
    const big = card({ id: 'b', types: ['Water'], hp: 200, bestDamage: 10 });
    const result = scoreHand(
      scoreInput([small, big], [small, big], { tools: [tool(9, 'colossus')] }),
    );
    expect(result.damage).toBe(10 + 200);
  });
});

describe('Contre-type', () => {
  it('la faiblesse donne ×3 au lieu de ×2', () => {
    const data = card({ id: 'v' });
    const result = scoreHand(
      scoreInput([data], [data], {
        tools: [tool(9, 'counterType')],
        opponent: { maxHp: 1000, weaknesses: ['Fire'], resistances: [] },
      }),
    );
    expect(result.mult).toBe(3);
  });

  it('sans faiblesse, il ne fait rien', () => {
    const data = card({ id: 'v' });
    const result = scoreHand(scoreInput([data], [data], { tools: [tool(9, 'counterType')] }));
    expect(result.mult).toBe(1);
  });
});

describe('Prisme', () => {
  it('les Incolore remplissent un Monotype', () => {
    const fire = fillers(3, { types: ['Fire'] });
    const colorless = fillers(2, { types: ['Colorless'] });
    const cards = [...fire, ...colorless];
    expect(scoreHand(scoreInput(cards, cards)).combo).toBe('single');
    const result = scoreHand(scoreInput(cards, cards, { tools: [tool(9, 'prism')] }));
    expect(result.combo).toBe('monotype');
  });

  it('les Incolore remplissent un Arc-en-ciel', () => {
    const cards = (['Fire', 'Water', 'Grass', 'Colorless', 'Colorless'] as const).map((type, i) =>
      card({ id: `c${i}`, types: [type] }),
    );
    const result = scoreHand(scoreInput(cards, cards, { tools: [tool(9, 'prism')] }));
    expect(result.combo).toBe('rainbow');
  });

  it('synergie Prisme + Feu de camp : les Incolore comptent pour le Feu de camp', () => {
    const colorless = card({ id: 'c', types: ['Colorless'] });
    const result = scoreHand(
      scoreInput([colorless], [colorless], {
        tools: [tool(8, 'prism'), tool(9, 'campfire', 'Fire')],
      }),
    );
    expect(result.mult).toBe(1 + 4);
  });
});

describe('Arbre généalogique', () => {
  it('une carte rejoue ses dégâts si sa pré-évolution est jouée', () => {
    const base = card({ id: 'a', name: { fr: 'A', en: 'A' }, dexIds: [920], bestDamage: 30 });
    const middle = card({
      id: 'b',
      name: { fr: 'B', en: 'B' },
      dexIds: [920],
      stage: 'Stage1',
      evolveFrom: 'A',
      bestDamage: 60,
    });
    const result = scoreHand(
      scoreInput([base, middle], [base, middle], { tools: [tool(9, 'familyTree')] }),
    );
    expect(result.damage).toBe(20 + 30 + 120);
  });
});

describe('Classeur rigide', () => {
  it('×1,5 Multi par carte holo jouée', () => {
    const [a, b] = fillers(2, { dexIds: [912] });
    const result = scoreHand(
      scoreInput(
        [instance(1, a as never, 'holo'), instance(2, b as never, 'holo')],
        [a, b] as never,
        {
          tools: [tool(9, 'rigidBinder')],
        },
      ),
    );
    expect(result.mult).toBe((2 + 20) * 2.25);
  });
});

describe('Pokédex', () => {
  it('+1 Multi par Pokémon différent joué pendant la run, main comprise', () => {
    const data = card({ id: 'v', dexIds: [950] });
    const result = scoreHand(
      scoreInput([data], [data], { tools: [tool(9, 'pokedex')], seenDexIds: [1, 2, 950] }),
    );
    expect(result.mult).toBe(1 + 3);
  });

  it("compte chaque Pokémon d'une TAG TEAM", () => {
    const data = card({ id: 'v', dexIds: [951, 952], isTagTeam: true });
    const result = scoreHand(scoreInput([data], [data], { tools: [tool(9, 'pokedex')] }));
    expect(result.mult).toBe(1 + 2);
  });
});

describe('Entraînement', () => {
  const base = card({ id: 'a', name: { fr: 'A', en: 'A' } });
  const middle = card({ id: 'b', name: { fr: 'B', en: 'B' }, stage: 'Stage1', evolveFrom: 'A' });
  const top = card({ id: 'c', name: { fr: 'C', en: 'C' }, stage: 'Stage2', evolveFrom: 'B' });
  const line = [base, middle, top];

  it('gagne ×0,1 dès la Lignée jouée', () => {
    const result = scoreHand(scoreInput(line, line, { tools: [tool(9, 'training')] }));
    expect(result.mult).toBeCloseTo(4 * 1.1);
  });

  it('garde les paliers déjà gagnés sur une autre main', () => {
    const trained = { ...tool(9, 'training'), stacks: 5 };
    const result = scoreHand(scoreInput([base], line, { tools: [trained] }));
    expect(result.mult).toBeCloseTo(1.5);
  });
});

describe('Illustrateur fétiche', () => {
  it('×2 si toutes les cartes jouées ont le même illustrateur', () => {
    const [a, b] = fillers(2, { dexIds: [913], illustrator: 'X' });
    const result = scoreHand(
      scoreInput([a, b] as never, [a, b] as never, { tools: [tool(9, 'favoriteArtist')] }),
    );
    expect(result.mult).toBe(4);
  });

  it('ne fait rien si les illustrateurs diffèrent', () => {
    const a = card({ id: 'a', dexIds: [914], illustrator: 'X' });
    const b = card({ id: 'b', dexIds: [914], illustrator: 'Y' });
    const result = scoreHand(scoreInput([a, b], [a, b], { tools: [tool(9, 'favoriteArtist')] }));
    expect(result.mult).toBe(2);
  });
});

describe('La Cote', () => {
  const tools = [tool(9, 'marketValue')];

  it('+Multi égal au prix en euros de chaque carte qui marque', () => {
    const data = card({ id: 'v', cardmarketPrice: 7.9 });
    expect(scoreHand(scoreInput([data], [data], { tools })).mult).toBe(1 + 7);
  });

  it('plafonne à 50', () => {
    const data = card({ id: 'v', cardmarketPrice: 400 });
    expect(scoreHand(scoreInput([data], [data], { tools })).mult).toBe(51);
  });

  it('se replie sur la rareté si le prix manque', () => {
    const data = card({ id: 'v', cardmarketPrice: null, rarity: 'Ultra Rare' });
    expect(scoreHand(scoreInput([data], [data], { tools })).mult).toBe(1 + 10);
  });
});

describe('Outils de la phase 2', () => {
  const single = card({ id: 'single', types: ['Fire'], bestDamage: 50, retreat: 1 });

  it('Tirelire : +1 Multi par tranche de 5 ₽ détenus', () => {
    const result = scoreHand(
      scoreInput([single], [single], { tools: [tool(9, 'piggyBank')], money: 14 }),
    );
    expect(result.mult).toBe(1 + 2);
  });

  it('Sieste : +2 Multi par point de Retraite restant', () => {
    const result = scoreHand(
      scoreInput([single], [single], { tools: [tool(9, 'nap')], retreatPoints: 3 }),
    );
    expect(result.mult).toBe(1 + 6);
  });

  it('Duo : +6 Multi sur une Paire, rien sur une carte seule', () => {
    const [a, b] = fillers(2, { dexIds: [920] });
    const pair = scoreHand(
      scoreInput([a, b] as never, [a, b] as never, { tools: [tool(9, 'duo')] }),
    );
    expect(pair.mult).toBe(2 + 6);
    const alone = scoreHand(scoreInput([single], [single], { tools: [tool(9, 'duo')] }));
    expect(alone.mult).toBe(1);
  });

  it("Pierre d'évolution : +3 Multi par carte évoluée jouée, même hors combinaison", () => {
    const basic = card({ id: 'b', stage: 'Basic' });
    const stage1 = card({ id: 's1', stage: 'Stage1', evolveFrom: 'b' });
    const stage2 = card({ id: 's2', stage: 'Stage2', evolveFrom: 's1' });
    const cards = [basic, stage1, stage2];
    const result = scoreHand(scoreInput(cards, cards, { tools: [tool(9, 'evolutionStone')] }));
    expect(result.mult).toBe(4 + 6);
  });

  it('Poids lourd : +4 Multi par carte à retraite 3 ou plus jouée', () => {
    const heavy = card({ id: 'h', retreat: 3, bestDamage: 90 });
    const huge = card({ id: 'u', retreat: 4, bestDamage: 80 });
    const cards = [heavy, huge, single];
    const result = scoreHand(scoreInput(cards, cards, { tools: [tool(9, 'heavyweight')] }));
    expect(result.mult).toBe(1 + 8);
  });

  it('Palette : ×2 Multi sur un Arc-en-ciel, rien sinon', () => {
    const types = ['Fire', 'Water', 'Grass', 'Psychic', 'Metal'] as const;
    const cards = types.map((type) => card({ id: `r-${type}`, types: [type] }));
    const rainbow = scoreHand(scoreInput(cards, cards, { tools: [tool(9, 'palette')] }));
    expect(rainbow.combo).toBe('rainbow');
    expect(rainbow.mult).toBe(4 * 2);
    const alone = scoreHand(scoreInput([single], [single], { tools: [tool(9, 'palette')] }));
    expect(alone.mult).toBe(1);
  });

  it('Boîte à badges : ×0,1 Multi de plus par combat gagné', () => {
    const result = scoreHand(
      scoreInput([single], [single], { tools: [tool(9, 'badgeCase')], fightsWon: 5 }),
    );
    expect(result.mult).toBeCloseTo(1.5);
  });
});
