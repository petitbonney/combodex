import { describe, expect, it } from 'vitest';
import { CONSUMABLE_PRICES, MIN_DECK_SIZE } from '../src/content/balance.ts';
import { ACE_SPEC_IDS, SPECIAL_ENERGY_IDS } from '../src/content/consumables.ts';
import { retreatCost } from '../src/engine/fight.ts';
import { applyAction } from '../src/engine/run.ts';
import { scoreHand } from '../src/engine/scoring.ts';
import { leapTarget } from '../src/engine/shop.ts';
import { IllegalActionError, type RunState, type ShopConsumable } from '../src/engine/state.ts';
import { card, fightRun, fillers, indexOf, instance, scoreInput, tool } from './helpers.ts';

function refusal(run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (error) {
    if (error instanceof IllegalActionError) return error.reason;
    throw error;
  }
}

const basic = card({ id: 'charmander', name: { fr: 'Salamèche', en: 'Charmander' } });
const middle = card({
  id: 'charmeleon',
  name: { fr: 'Reptincel', en: 'Charmeleon' },
  stage: 'Stage1',
  evolveFrom: 'Charmander',
});
const top = card({
  id: 'charizard',
  name: { fr: 'Dracaufeu', en: 'Charizard' },
  stage: 'Stage2',
  evolveFrom: 'Charmeleon',
});
const deckCards = [basic, middle, top, ...fillers(17)];
const index = indexOf(deckCards);

function shopRun(consumable: ShopConsumable | null, overrides: Partial<RunState> = {}): RunState {
  return {
    ...fightRun({ deck: deckCards }),
    phase: 'shop',
    fight: null,
    money: 20,
    shop: { slots: [], boosters: [], consumable, rerollCost: 5 },
    ...overrides,
  };
}

const act = (state: RunState, action: Parameters<typeof applyAction>[1]) =>
  applyAction(state, action, index);

describe('consommable de boutique', () => {
  it('attache une énergie de base à la carte choisie', () => {
    const before = shopRun({ kind: 'energy', energy: 'Water', price: 2 });
    const { state } = act(before, { type: 'buyConsumable', targetUid: 4 });
    expect(state.deck[4]?.energies).toEqual(['Water']);
    expect(state.money).toBe(18);
    expect(state.shop?.consumable).toBeNull();
  });

  it('attache une énergie spéciale à la carte choisie', () => {
    const before = shopRun({ kind: 'special', special: 'force', price: 4 });
    const { state } = act(before, { type: 'buyConsumable', targetUid: 2 });
    expect(state.deck[2]?.specials).toEqual(['force']);
  });

  it('exige une cible pour une énergie', () => {
    const before = shopRun({ kind: 'energy', energy: 'Water', price: 2 });
    expect(refusal(() => act(before, { type: 'buyConsumable' }))).toBe('invalidTarget');
  });

  it('refuse un achat sans les ₽', () => {
    const before = shopRun({ kind: 'leap', price: 5 }, { money: 1 });
    const action = { type: 'buyConsumable', targetUid: 0 } as const;
    expect(refusal(() => act(before, action))).toBe('notEnoughMoney');
  });

  it('refuse un emplacement déjà acheté', () => {
    expect(refusal(() => act(shopRun(null), { type: 'buyConsumable' }))).toBe('emptySlot');
  });

  it('le Saut d’évolution pose le Niveau 2 sur une Base', () => {
    expect(leapTarget(index, basic)?.id).toBe('charizard');
    const before = shopRun({ kind: 'leap', price: 5 });
    const { state } = act(before, { type: 'buyConsumable', targetUid: 0 });
    expect(state.deck[0]?.cardId).toBe('charizard');
  });

  it('le Saut d’évolution refuse une carte sans Niveau 2', () => {
    const before = shopRun({ kind: 'leap', price: 5 });
    const action = { type: 'buyConsumable', targetUid: 5 } as const;
    expect(refusal(() => act(before, action))).toBe('invalidEvolution');
  });

  it('un ACE SPEC part en réserve, un seul à la fois', () => {
    const offer: ShopConsumable = { kind: 'ace', ace: 'jackpot', price: 7 };
    const { state } = act(shopRun(offer), { type: 'buyConsumable' });
    expect(state.aceSpec).toBe('jackpot');
    const full = shopRun(offer, { aceSpec: 'duplicator' });
    expect(refusal(() => act(full, { type: 'buyConsumable' }))).toBe('aceReserveFull');
  });

  it('garde des prix fixes par sorte', () => {
    expect(CONSUMABLE_PRICES.ace).toBeGreaterThan(CONSUMABLE_PRICES.energy);
  });
});

describe('ACE SPEC', () => {
  const inFight = (ace: RunState['aceSpec']) => {
    const run = fightRun({ deck: deckCards });
    return { ...run, aceSpec: ace };
  };

  it('couvre les 3 exemples du game design', () => {
    expect(ACE_SPEC_IDS).toEqual(
      expect.arrayContaining(['goldenHand', 'duplicator', 'bigCleanup']),
    );
  });

  it('refuse sans ACE SPEC en réserve', () => {
    expect(refusal(() => act(inFight(null), { type: 'useAce' }))).toBe('noAce');
  });

  it('Main d’or : toutes les cartes de la main deviennent holo', () => {
    const before = inFight('goldenHand');
    const { state, events } = act(before, { type: 'useAce' });
    const hand = state.fight?.hand ?? [];
    for (const uid of hand) expect(state.deck[uid]?.variant).toBe('holo');
    expect(state.aceSpec).toBeNull();
    expect(events).toContainEqual({ type: 'aceUsed', id: 'goldenHand' });
  });

  it('Pluie d’énergie : chaque carte de la main reçoit son type', () => {
    const { state } = act(inFight('energyRain'), { type: 'useAce' });
    const uid = state.fight?.hand[0] as number;
    expect(state.deck[uid]?.energies).toEqual(['Fire']);
  });

  it('Second souffle : +2 Tours et +2 points de Retraite', () => {
    const { state } = act(inFight('secondWind'), { type: 'useAce' });
    expect(state.fight?.maxTurns).toBe(6);
    expect(state.fight?.retreatPoints).toBe(6);
  });

  it('un ACE SPEC de combat ne sert pas en boutique, et inversement', () => {
    const shop = shopRun(null, { aceSpec: 'goldenHand' });
    expect(refusal(() => act(shop, { type: 'useAce' }))).toBe('aceNotNow');
    const fight = inFight('duplicator');
    expect(refusal(() => act(fight, { type: 'useAce', targetUids: [0] }))).toBe('aceNotNow');
  });

  it('Duplicateur : copie la carte avec ses bonus', () => {
    const before = shopRun(null, { aceSpec: 'duplicator' });
    const target = before.deck[1];
    if (target) Object.assign(target, { variant: 'holo', energies: ['Water'], specials: ['echo'] });
    const { state } = act(before, { type: 'useAce', targetUids: [1] });
    const copy = state.deck.at(-1);
    expect(state.deck).toHaveLength(before.deck.length + 1);
    expect(copy).toMatchObject({
      cardId: 'charmeleon',
      variant: 'holo',
      energies: ['Water'],
      specials: ['echo'],
    });
    expect(copy?.uid).not.toBe(1);
  });

  it('Grand ménage : détruit 3 cartes et ajoute un emplacement', () => {
    const before = shopRun(null, { aceSpec: 'bigCleanup' });
    const { state } = act(before, { type: 'useAce', targetUids: [3, 4, 5] });
    expect(state.deck).toHaveLength(before.deck.length - 3);
    expect(state.toolSlots).toBe(6);
  });

  it('demande le bon nombre de cibles', () => {
    const before = shopRun(null, { aceSpec: 'bigCleanup' });
    const action = { type: 'useAce' as const, targetUids: [3] };
    expect(refusal(() => act(before, action))).toBe('invalidTarget');
  });

  it('Presse d’imprimerie : la carte passe en 1re édition', () => {
    const before = shopRun(null, { aceSpec: 'printingPress' });
    const { state } = act(before, { type: 'useAce', targetUids: [2] });
    expect(state.deck[2]?.variant).toBe('firstEdition');
  });

  it('Gros lot : double les ₽, jusqu’à +20', () => {
    const small = shopRun(null, { aceSpec: 'jackpot', money: 7 });
    expect(act(small, { type: 'useAce' }).state.money).toBe(14);
    const big = shopRun(null, { aceSpec: 'jackpot', money: 50 });
    expect(act(big, { type: 'useAce' }).state.money).toBe(70);
  });

  it('Tirage légendaire : ajoute une carte de haute rareté en holo', () => {
    const rare = card({ id: 'rare-one', rarity: 'Ultra Rare' });
    const cards = [...deckCards, rare];
    const before = { ...shopRun(null), aceSpec: 'legendaryPull' as const };
    const { state } = applyAction(before, { type: 'useAce' }, indexOf(cards));
    expect(state.deck.at(-1)).toMatchObject({ cardId: 'rare-one', variant: 'holo' });
  });
});

describe('énergies spéciales', () => {
  const fire = card({ id: 'fire', bestDamage: 50, types: ['Fire'] });
  const water = card({ id: 'water', bestDamage: 50, types: ['Water'] });
  const withSpecial = (special: (typeof SPECIAL_ENERGY_IDS)[number]) => ({
    ...instance(1, fire),
    specials: [special],
  });

  it('existent en 7 sortes', () => {
    expect(SPECIAL_ENERGY_IDS).toHaveLength(7);
  });

  it('Double : +30 Dégâts', () => {
    const plain = scoreHand(scoreInput([instance(1, fire)], [fire]));
    const boosted = scoreHand(scoreInput([withSpecial('double')], [fire]));
    expect(boosted.damage - plain.damage).toBe(30);
  });

  it('Force : +4 Multi', () => {
    const plain = scoreHand(scoreInput([instance(1, fire)], [fire]));
    const boosted = scoreHand(scoreInput([withSpecial('force')], [fire]));
    expect(boosted.mult - plain.mult).toBe(4);
  });

  it('Écho : ×1,25 Multi', () => {
    const result = scoreHand(scoreInput([withSpecial('echo')], [fire]));
    expect(result.mult).toBe(1.25);
  });

  it('Fortune : +1 ₽ quand la carte marque', () => {
    const result = scoreHand(scoreInput([withSpecial('fortune')], [fire]));
    expect(result.moneyGained).toBe(1);
  });

  it('Multicolore : complète un Monotype', () => {
    const team = fillers(4, { types: ['Water'] });
    const special = { ...instance(9, fire), specials: ['rainbow' as const] };
    const result = scoreHand(scoreInput([...team, special], [...team, fire]));
    expect(result.combo).toBe('monotype');
  });

  it('Bouclier : ignore la résistance', () => {
    const opponent = { maxHp: 1000, weaknesses: [], resistances: ['Fire' as const] };
    const plain = scoreHand(scoreInput([instance(1, fire)], [fire], { opponent }));
    const shielded = scoreHand(scoreInput([withSpecial('shield')], [fire], { opponent }));
    expect(shielded.damage - plain.damage).toBe(30);
  });

  it('Légère : la défausse ne coûte rien', () => {
    const heavy = card({ id: 'heavy', retreat: 3 });
    const deck = [heavy, water, ...fillers(8)];
    const run = fightRun({ deck });
    const target = run.deck[0];
    if (target) target.specials = ['light'];
    const fight = run.fight;
    if (!fight) throw new Error('Combat manquant');
    expect(retreatCost(run, fight, indexOf(deck), 0)).toBe(0);
  });

  it('comptent pour la Batterie', () => {
    const special = withSpecial('force');
    const result = scoreHand(scoreInput([special], [fire], { tools: [tool(50, 'battery')] }));
    const step = result.steps.find((entry) => entry.kind === 'tool');
    expect(step).toMatchObject({ addMult: 2 });
  });
});

describe('Centre Pokémon', () => {
  it('retire gratuitement une carte, une fois par Arène', () => {
    const before = shopRun(null);
    const { state } = act(before, { type: 'removeCard', uid: 3 });
    expect(state.deck.some((entry) => entry.uid === 3)).toBe(false);
    expect(state.money).toBe(before.money);
    expect(refusal(() => act(state, { type: 'removeCard', uid: 4 }))).toBe('centerUsed');
  });

  it('se recharge à l’Arène suivante', () => {
    const before = shopRun(null, { arenaCenterUsed: true, stageIndex: 2 });
    const { state } = act(before, { type: 'leaveShop' });
    expect(state.arenaCenterUsed).toBe(false);
  });

  it('ne reste pas ouvert pendant un Dresseur suivant de la même Arène', () => {
    const before = shopRun(null, { arenaCenterUsed: true, stageIndex: 0 });
    const { state } = act(before, { type: 'leaveShop' });
    expect(state.arenaCenterUsed).toBe(true);
  });

  it('ne descend pas sous une main de cartes', () => {
    const deck = shopRun(null).deck.slice(0, MIN_DECK_SIZE);
    const before = shopRun(null, { deck });
    expect(refusal(() => act(before, { type: 'removeCard', uid: 0 }))).toBe('deckTooSmall');
  });

  it('refuse hors de la boutique', () => {
    const run = fightRun({ deck: deckCards });
    expect(refusal(() => act(run, { type: 'removeCard', uid: 0 }))).toBe('noShop');
  });
});
