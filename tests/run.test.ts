import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { ARENA_HP, TOOL_PRICES } from '../src/content/balance.ts';
import type { CardSet } from '../src/engine/cards.ts';
import { cardOf, indexCards } from '../src/engine/cards.ts';
import { createRng } from '../src/engine/rng.ts';
import { applyAction, createRun, currentArena } from '../src/engine/run.ts';
import { tagTeamCount } from '../src/engine/shop.ts';
import { generateStarterDeck } from '../src/engine/starter-deck.ts';
import type { Action, RunState, ShopState } from '../src/engine/state.ts';
import { fightRun, opponent, tool } from './helpers.ts';

const set: CardSet = JSON.parse(readFileSync('data/sm12.json', 'utf8'));
const index = indexCards(set);

const act = (state: RunState, action: Action) => applyAction(state, action, index);

/** Une boutique ouverte avec des emplacements choisis. */
function shopRun(money: number, shop: Partial<ShopState> = {}): RunState {
  const run = createRun(index, { seed: 12 });
  return {
    ...run,
    phase: 'shop',
    money,
    shop: {
      slots: [],
      boosters: [
        { kind: 'set', price: 4 },
        { kind: 'energy', price: 4 },
      ],
      consumable: null,
      rerollCost: 5,
      ...shop,
    },
  };
}

/** Un combat réel dont l'adversaire n'a plus qu'1 PV. */
function nearlyWon(kind: 'trainer' | 'elite' | 'champion', money = 0, turn = 1): RunState {
  const cards = set.cards.slice(0, 20);
  const stageIndex = { trainer: 0, elite: 1, champion: 2 }[kind];
  return fightRun({
    deck: cards,
    fight: { turn, opponent: opponent({ kind, hp: 1 }) },
    run: {
      money,
      stageIndex,
      arenas: createRun(index, { seed: 1 }).arenas,
    },
  });
}

describe('création de la run', () => {
  it("rejoue une run à l'identique avec une même graine", () => {
    expect(createRun(index, { seed: 99 })).toEqual(createRun(index, { seed: 99 }));
    expect(createRun(index, { seed: 99 }).deck).not.toEqual(createRun(index, { seed: 7 }).deck);
  });

  it("prépare 8 Arènes de types distincts, avec une forme d'effet chacune, puis la Ligue", () => {
    const { arenas } = createRun(index, { seed: 5 });
    expect(arenas).toHaveLength(9);
    const gyms = arenas.slice(0, 8);
    expect(new Set(gyms.map((arena) => arena.type)).size).toBe(8);
    for (const arena of arenas) expect(['permanent', 'statuses']).toContain(arena.form);
    expect(arenas.at(-1)?.league).toBe(true);
    expect(gyms.every((arena) => !arena.league)).toBe(true);
  });

  it('tire effet permanent ou statuts avec une chance sur deux', () => {
    const forms = Array.from({ length: 200 }, (_, seed) =>
      createRun(index, { seed: seed + 1 }).arenas.map((arena) => arena.form),
    ).flat();
    const permanent = forms.filter((form) => form === 'permanent').length / forms.length;
    expect(permanent).toBeGreaterThan(0.42);
    expect(permanent).toBeLessThan(0.58);
  });

  it("un type qui revient prend l'autre forme d'effet", () => {
    const { arenas } = createRun(index, { seed: 8, arenaCount: 13, league: false });
    const seen = new Map<string, string>();
    for (const arena of arenas) {
      const earlier = seen.get(arena.type);
      if (earlier) expect(arena.form).not.toBe(earlier);
      seen.set(arena.type, arena.form);
    }
    expect(arenas).toHaveLength(13);
  });

  it("le Champion est une vraie carte à gros PV du type de l'Arène", () => {
    const run = createRun(index, { seed: 5 });
    for (const arena of run.arenas) {
      const champion = index.byId.get(arena.championCardId);
      expect(champion?.types[0]).toBe(arena.type);
    }
  });
});

describe('deck de départ', () => {
  const deckOf = (seed: number) =>
    generateStarterDeck(createRng(seed), index).map(({ cardId }) => {
      const card = index.byId.get(cardId);
      if (!card) throw new Error(cardId);
      return card;
    });

  it('contient 20 cartes sans TAG TEAM', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const deck = deckOf(seed);
      expect(deck).toHaveLength(20);
      expect(deck.filter((card) => card.isTagTeam)).toEqual([]);
    }
  });

  it('contient 2 lignées complètes de types différents, sur 2 Base, 2 Niveau 1, 1 Niveau 2', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const deck = deckOf(seed);
      const tops = deck.filter((card) => card.stage === 'Stage2');
      expect(tops).toHaveLength(2);
      expect(tops[0]?.types[0]).not.toBe(tops[1]?.types[0]);
      expect(deck.filter((card) => card.stage === 'Stage1')).toHaveLength(4);
      for (const top of tops) {
        const middles = deck.filter((card) => card.name.en === top.evolveFrom);
        expect(middles).toHaveLength(2);
        const middle = middles[0];
        expect(
          deck.filter((card) => card.name.en === middle?.evolveFrom).length,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('prévoit des doublons pour permettre les Paires', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const deck = deckOf(seed);
      const counts = new Map<number, number>();
      for (const card of deck) {
        const dexId = card.dexIds[0] as number;
        counts.set(dexId, (counts.get(dexId) ?? 0) + 1);
      }
      expect([...counts.values()].filter((count) => count >= 2).length).toBeGreaterThan(2);
    }
  });

  it('les 10 Pokémon de Base tiennent sur 2 ou 3 types', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const deck = deckOf(seed).slice(10);
      expect(deck.every((card) => card.stage === 'Basic')).toBe(true);
      expect(new Set(deck.map((card) => card.types[0])).size).toBeLessThanOrEqual(3);
    }
  });

  it("une carte n'existe que dans une variante réelle", () => {
    const starter = generateStarterDeck(createRng(4), index);
    for (const { cardId, variant } of starter) {
      expect(index.byId.get(cardId)?.variants).toContain(variant);
    }
  });
});

describe('adversaires', () => {
  it('le Dresseur a la moitié des PV du Champion, sans effet de boss', () => {
    const { state } = act(createRun(index, { seed: 2 }), { type: 'startFight' });
    expect(state.fight?.opponent).toMatchObject({
      kind: 'trainer',
      maxHp: ARENA_HP[0] / 2,
      form: null,
    });
    expect(state.fight?.announcedStatus).toBeNull();
  });

  it("le Dresseur d'élite a les trois quarts des PV", () => {
    const run = { ...createRun(index, { seed: 2 }), stageIndex: 1 };
    const { state } = act(run, { type: 'startFight' });
    expect(state.fight?.opponent).toMatchObject({ kind: 'elite', maxHp: ARENA_HP[0] * 0.75 });
  });

  it("le Champion porte la forme d'effet de l'Arène et sa vraie faiblesse", () => {
    const run = { ...createRun(index, { seed: 2 }), stageIndex: 2 };
    const arena = currentArena(run);
    const { state } = act(run, { type: 'startFight' });
    const champion = index.byId.get(arena.championCardId);
    expect(state.fight?.opponent).toMatchObject({
      kind: 'champion',
      maxHp: ARENA_HP[0],
      form: arena.form,
      weaknesses: champion?.weaknesses,
      resistances: champion?.resistances,
    });
  });

  it('annonce le statut du premier Tour au début du combat', () => {
    const base = createRun(index, { seed: 2 });
    const arenas = base.arenas.map((arena) => ({ ...arena, form: 'statuses' as const }));
    const { events } = act({ ...base, arenas, stageIndex: 2 }, { type: 'startFight' });
    const announces = events.filter((event) => event.type === 'statusAnnounced');
    expect(announces).toHaveLength(2);
    expect(events.map((event) => event.type).indexOf('statusAnnounced')).toBeLessThan(
      events.map((event) => event.type).indexOf('turnStarted'),
    );
  });
});

describe('passer un combat', () => {
  it('donne un booster gratuit, sans gains ni boutique', () => {
    const run = createRun(index, { seed: 2 });
    const { state } = act(run, { type: 'skipFight' });
    expect(state.phase).toBe('booster');
    expect(state.booster?.free).toBe(true);
    expect(state.money).toBe(0);
    const after = act(state, { type: 'skipBooster' }).state;
    expect(after.phase).toBe('intro');
    expect(after.stageIndex).toBe(1);
    expect(after.shop).toBeNull();
  });

  it('le Champion ne se passe pas', () => {
    const run = { ...createRun(index, { seed: 2 }), stageIndex: 2 };
    expect(() => act(run, { type: 'skipFight' })).toThrow(/championCannotBeSkipped/);
  });
});

describe('gains', () => {
  const gains = (state: RunState) => {
    const { events } = act(state, { type: 'play', uids: [state.fight?.hand[0] as number] });
    const won = events.find((event) => event.type === 'fightWon');
    if (!won || !('gains' in won)) throw new Error('Pas de victoire');
    return won.gains;
  };

  it("3 ₽ contre un Dresseur, 4 ₽ contre l'élite, 5 ₽ contre un Champion", () => {
    expect(gains(nearlyWon('trainer')).victory).toBe(3);
    expect(gains(nearlyWon('elite')).victory).toBe(4);
    expect(gains(nearlyWon('champion')).victory).toBe(5);
  });

  it('+1 ₽ par Tour non utilisé', () => {
    expect(gains(nearlyWon('trainer', 0, 1)).unusedTurns).toBe(3);
    expect(gains(nearlyWon('trainer', 0, 4)).unusedTurns).toBe(0);
  });

  it('intérêts : +1 ₽ par tranche de 5 ₽, plafonnés à 5 ₽', () => {
    expect(gains(nearlyWon('trainer', 4)).interest).toBe(0);
    expect(gains(nearlyWon('trainer', 12)).interest).toBe(2);
    expect(gains(nearlyWon('trainer', 100)).interest).toBe(5);
  });

  it('Pique-nique : +2 ₽ par Tour non utilisé', () => {
    const state = nearlyWon('trainer');
    state.tools = [tool(500, 'picnic')];
    expect(gains(state).picnic).toBe(6);
  });

  it('crédite le total et ouvre la boutique', () => {
    const { state } = act(nearlyWon('trainer', 5), { type: 'play', uids: [0] });
    expect(state.money).toBe(5 + 3 + 3 + 1);
    expect(state.phase).toBe('shop');
  });
});

describe('enchaînement des combats', () => {
  it("passe du Dresseur à l'élite puis au Champion", () => {
    let state = createRun(index, { seed: 2 });
    state = {
      ...state,
      phase: 'shop',
      shop: { slots: [], boosters: [], consumable: null, rerollCost: 5 },
    };
    state = act(state, { type: 'leaveShop' }).state;
    expect(state).toMatchObject({ stageIndex: 1, arenaIndex: 0, phase: 'intro' });
  });

  it("change d'Arène après le Champion et remet à zéro les effets d'Arène", () => {
    let state = createRun(index, { seed: 2 });
    state = {
      ...state,
      stageIndex: 2,
      arenaBanishedUids: [1],
      arenaEvolutionUsed: true,
      phase: 'shop',
      shop: { slots: [], boosters: [], consumable: null, rerollCost: 5 },
    };
    const { state: after, events } = act(state, { type: 'leaveShop' });
    expect(after).toMatchObject({
      stageIndex: 0,
      arenaIndex: 1,
      arenaBanishedUids: [],
      arenaEvolutionUsed: false,
    });
    expect(events).toContainEqual({ type: 'arenaCleared', arenaIndex: 0 });
  });

  it('la run est gagnée après la dernière étape', () => {
    const state = nearlyWon('champion');
    state.arenaIndex = state.arenas.length - 1;
    const { state: after, events } = act(state, { type: 'play', uids: [0] });
    expect(after.phase).toBe('won');
    expect(events).toContainEqual({ type: 'runWon' });
  });

  it("les cartes bannies restent hors du deck jusqu'à la fin de l'Arène", () => {
    const run = { ...createRun(index, { seed: 2 }), arenaBanishedUids: [0, 1, 2] };
    const { state } = act(run, { type: 'startFight' });
    const all = [...(state.fight?.hand ?? []), ...(state.fight?.drawPile ?? [])];
    expect(all).toHaveLength(17);
    expect(all).not.toContain(0);
  });
});

describe('boutique', () => {
  const common = set.cards.find((card) => card.rarity === 'Common' && !card.isTagTeam);
  const stage1 = set.cards.find(
    (card) => card.stage === 'Stage1' && card.rarity === 'Uncommon' && card.evolveFrom,
  );
  const base = set.cards.find((card) => card.name.en === stage1?.evolveFrom);
  const tagTeam = set.cards.find((card) => card.isTagTeam);

  let opened: RunState;
  beforeAll(() => {
    opened = act(nearlyWon('trainer'), { type: 'play', uids: [0] }).state;
  });

  it('propose 2 emplacements, 2 boosters et une relance à 5 ₽', () => {
    expect(opened.shop?.slots).toHaveLength(2);
    expect(opened.shop?.boosters).toHaveLength(2);
    expect(opened.shop?.rerollCost).toBe(5);
  });

  it("tire 2 boosters différents, le Premium plus rare que le booster d'extension", () => {
    const counts: Record<string, number> = {};
    for (let seed = 1; seed <= 600; seed++) {
      const run: RunState = { ...nearlyWon('trainer'), rng: createRng(seed) };
      const kinds = act(run, { type: 'play', uids: [0] }).state.shop?.boosters.map(
        (booster) => booster?.kind as string,
      );
      expect(new Set(kinds).size).toBe(2);
      for (const kind of kinds ?? []) counts[kind] = (counts[kind] ?? 0) + 1;
    }
    expect(Object.keys(counts).sort()).toEqual(['energy', 'premium', 'set', 'trainer']);
    expect(counts.premium as number).toBeLessThan(counts.set as number);
  });

  it("ne vend jamais de TAG TEAM à l'unité", () => {
    let state = opened;
    for (let i = 0; i < 300; i++) {
      state = { ...state, money: 100, shop: { ...(state.shop as ShopState), rerollCost: 1 } };
      state = act(state, { type: 'reroll' }).state;
      for (const slot of state.shop?.slots ?? []) {
        if (slot?.kind === 'card') expect(index.byId.get(slot.cardId)?.isTagTeam).toBe(false);
      }
    }
  });

  it('applique le prix de la rareté et une variante réelle', () => {
    let state = opened;
    for (let i = 0; i < 100; i++) {
      state = { ...state, money: 100, shop: { ...(state.shop as ShopState), rerollCost: 1 } };
      state = act(state, { type: 'reroll' }).state;
      for (const slot of state.shop?.slots ?? []) {
        if (slot?.kind !== 'card') continue;
        const card = index.byId.get(slot.cardId);
        expect(card?.variants).toContain(slot.variant);
        const prices = { Common: 2, Uncommon: 3, Rare: 5, 'Ultra Rare': 8, 'Secret Rare': 8 };
        expect(slot.price).toBe(prices[card?.rarity ?? 'Common']);
      }
    }
  });

  it("vend les Outils selon le barème, sans doublon d'un Outil possédé", () => {
    expect(TOOL_PRICES).toEqual({ common: 4, uncommon: 5, rare: 7, legendary: 10 });
    let state: RunState = { ...opened, tools: [tool(500, 'prism')] };
    for (let i = 0; i < 200; i++) {
      state = { ...state, money: 100, shop: { ...(state.shop as ShopState), rerollCost: 1 } };
      state = act(state, { type: 'reroll' }).state;
      for (const slot of state.shop?.slots ?? []) {
        if (slot?.kind === 'tool') expect(slot.toolId).not.toBe('prism');
      }
    }
  });

  it('achète une carte, qui rejoint le deck', () => {
    const slot = {
      kind: 'card' as const,
      cardId: common?.id as string,
      variant: 'normal' as const,
      price: 2,
    };
    const state = shopRun(5, { slots: [slot] });
    const after = act(state, { type: 'buySlot', index: 0 }).state;
    expect(after.money).toBe(3);
    expect(after.deck).toHaveLength(21);
    expect(after.shop?.slots[0]).toBeNull();
  });

  it('refuse un achat sans assez de ₽', () => {
    const slot = {
      kind: 'card' as const,
      cardId: common?.id as string,
      variant: 'normal' as const,
      price: 2,
    };
    expect(() => act(shopRun(1, { slots: [slot] }), { type: 'buySlot', index: 0 })).toThrow(
      /notEnoughMoney/,
    );
  });

  it('évolution permanente : un Niveau 1 se pose sur sa Base, qui garde énergies et variante', () => {
    const slot = {
      kind: 'card' as const,
      cardId: stage1?.id as string,
      variant: 'normal' as const,
      price: 3,
    };
    const state = shopRun(5, { slots: [slot] });
    state.deck[0] = { uid: 0, cardId: base?.id as string, variant: 'reverse', energies: ['Metal'] };
    const after = act(state, { type: 'buySlot', index: 0, evolveUid: 0 }).state;
    expect(after.deck).toHaveLength(20);
    expect(after.deck[0]).toEqual({
      uid: 0,
      cardId: stage1?.id,
      variant: 'reverse',
      energies: ['Metal'],
    });
  });

  it("refuse une évolution sur une carte d'une autre lignée", () => {
    const slot = {
      kind: 'card' as const,
      cardId: stage1?.id as string,
      variant: 'normal' as const,
      price: 3,
    };
    const state = shopRun(5, { slots: [slot] });
    const stranger = set.cards.find((card) => card.name.en !== stage1?.evolveFrom);
    state.deck[0] = { uid: 0, cardId: stranger?.id as string, variant: 'normal', energies: [] };
    expect(() => act(state, { type: 'buySlot', index: 0, evolveUid: 0 })).toThrow(
      /invalidEvolution/,
    );
  });

  it('achète un Outil et le revend pour la moitié de son prix', () => {
    const slot = { kind: 'tool' as const, toolId: 'colossus' as const, type: null, price: 5 };
    const bought = act(shopRun(5, { slots: [slot] }), { type: 'buySlot', index: 0 }).state;
    expect(bought.money).toBe(0);
    expect(bought.tools).toHaveLength(1);
    const uid = bought.tools[0]?.uid as number;
    const sold = act(bought, { type: 'sellTool', uid }).state;
    expect(sold.money).toBe(2);
    expect(sold.tools).toEqual([]);
  });

  it('refuse un 6e Outil', () => {
    const slot = { kind: 'tool' as const, toolId: 'colossus' as const, type: null, price: 5 };
    const state = shopRun(50, { slots: [slot] });
    state.tools = [1, 2, 3, 4, 5].map((uid) => tool(uid + 500, 'picnic'));
    expect(() => act(state, { type: 'buySlot', index: 0 })).toThrow(/toolSlotsFull/);
  });

  it('relancer coûte 5 ₽, puis 1 ₽ de plus', () => {
    let state: RunState = { ...opened, money: 12 };
    state = act(state, { type: 'reroll' }).state;
    expect(state.money).toBe(7);
    expect(state.shop?.rerollCost).toBe(6);
    state = act(state, { type: 'reroll' }).state;
    expect(state.money).toBe(1);
    expect(() => act(state, { type: 'reroll' })).toThrow(/notEnoughMoney/);
  });

  describe('booster Premium', () => {
    const premium = { boosters: [{ kind: 'premium' as const, price: 8 }] };

    it('coûte 8 ₽ et contient 5 Pokémon dont 1 holo garanti', () => {
      for (let seed = 1; seed <= 200; seed++) {
        const run: RunState = { ...shopRun(8, premium), rng: createRng(seed) };
        const { state } = act(run, { type: 'buyBooster', index: 0 });
        expect(state.money).toBe(0);
        expect(state.booster?.cards).toHaveLength(5);
        const holo = state.booster?.cards.at(-1);
        expect(holo?.variant).toBe('holo');
        expect(index.byId.get(holo?.cardId ?? '')?.variants).toContain('holo');
      }
    });

    it('laisse garder 2 cartes, puis se referme', () => {
      const { state } = act(shopRun(8, premium), { type: 'buyBooster', index: 0 });
      const second = state.booster?.cards[1];
      const once = act(state, { type: 'keepBoosterCard', index: 0 }).state;
      expect(once.phase).toBe('booster');
      expect(once.booster?.cards).toHaveLength(4);
      expect(once.booster?.cards[0]).toEqual(second);
      const twice = act(once, { type: 'keepBoosterCard', index: 0 }).state;
      expect(twice.phase).toBe('shop');
      expect(twice.deck).toHaveLength(22);
    });

    it('se referme sans la seconde carte si le joueur renonce', () => {
      const { state } = act(shopRun(8, premium), { type: 'buyBooster', index: 0 });
      const once = act(state, { type: 'keepBoosterCard', index: 0 }).state;
      const after = act(once, { type: 'skipBooster' }).state;
      expect(after.phase).toBe('shop');
      expect(after.deck).toHaveLength(21);
    });
  });

  describe('booster Dresseur', () => {
    const trainer = { boosters: [{ kind: 'trainer' as const, price: 6 }] };

    it('coûte 6 ₽ et propose 3 Outils différents, dont 1 gardé', () => {
      const { state } = act(shopRun(6, trainer), { type: 'buyBooster', index: 0 });
      expect(state.money).toBe(0);
      const tools = state.booster?.tools ?? [];
      expect(tools).toHaveLength(3);
      expect(new Set(tools.map((tool) => `${tool.toolId}${tool.type}`)).size).toBe(3);
      const after = act(state, { type: 'keepBoosterTool', index: 1 }).state;
      expect(after.phase).toBe('shop');
      expect(after.tools).toHaveLength(1);
      expect(after.tools[0]?.toolId).toBe(tools[1]?.toolId);
      expect(after.tools[0]?.price).toBe(tools[1]?.price);
    });

    it('ne propose ni un Outil possédé ni un Outil en vitrine', () => {
      for (let seed = 1; seed <= 100; seed++) {
        const slots = [{ kind: 'tool' as const, toolId: 'prism' as const, type: null, price: 5 }];
        const owned = [{ uid: 99, toolId: 'picnic' as const, type: null, price: 4, stacks: 0 }];
        const run: RunState = {
          ...shopRun(6, { ...trainer, slots }),
          tools: owned,
          rng: createRng(seed),
        };
        const ids = act(run, { type: 'buyBooster', index: 0 }).state.booster?.tools.map(
          (tool) => tool.toolId,
        );
        expect(ids).not.toContain('prism');
        expect(ids).not.toContain('picnic');
      }
    });

    it('refuse un Outil de plus quand les emplacements sont pleins, sauf après une revente', () => {
      const owned = Array.from({ length: 5 }, (_, uid) => ({
        uid: 100 + uid,
        toolId: 'picnic' as const,
        type: null,
        price: 4,
        stacks: 0,
      }));
      const run: RunState = { ...shopRun(6, trainer), tools: owned };
      const { state } = act(run, { type: 'buyBooster', index: 0 });
      expect(() => act(state, { type: 'keepBoosterTool', index: 0 })).toThrow(/toolSlotsFull/);
      const sold = act(state, { type: 'sellTool', uid: 100 }).state;
      expect(sold.money).toBe(2);
      expect(sold.phase).toBe('booster');
      const after = act(sold, { type: 'keepBoosterTool', index: 0 }).state;
      expect(after.tools).toHaveLength(5);
    });
  });

  describe("booster d'extension", () => {
    it('coûte 4 ₽ et révèle 5 Pokémon, dont 1 gardé', () => {
      const { state } = act(shopRun(4), { type: 'buyBooster', index: 0 });
      expect(state.phase).toBe('booster');
      expect(state.money).toBe(0);
      expect(state.booster?.cards).toHaveLength(5);
      const after = act(state, { type: 'keepBoosterCard', index: 2 }).state;
      expect(after.phase).toBe('shop');
      expect(after.deck).toHaveLength(21);
      expect(after.shop?.boosters[0]).toBeNull();
    });

    it('sort une carte Ultra rare environ 1 booster sur 10', () => {
      let withUltra = 0;
      const total = 1500;
      for (let seed = 1; seed <= total; seed++) {
        const state: RunState = { ...shopRun(4), rng: createRng(seed) };
        const opened = act(state, { type: 'buyBooster', index: 0 }).state;
        const ultra = opened.booster?.cards.some((entry) =>
          ['Ultra Rare', 'Secret Rare'].includes(index.byId.get(entry.cardId)?.rarity ?? ''),
        );
        if (ultra) withUltra += 1;
      }
      expect(withUltra / total).toBeGreaterThan(0.07);
      expect(withUltra / total).toBeLessThan(0.13);
    });

    it('limite le deck à 2 TAG TEAM', () => {
      const state: RunState = {
        ...shopRun(0),
        phase: 'booster',
        booster: {
          kind: 'set',
          cards: [{ cardId: tagTeam?.id as string, variant: 'holo' }],
          energies: [],
          tools: [],
          keeps: 1,
          free: false,
        },
      };
      state.deck[0] = { uid: 0, cardId: tagTeam?.id as string, variant: 'holo', energies: [] };
      expect(tagTeamCount(state, index)).toBe(1);
      const second = act(state, { type: 'keepBoosterCard', index: 0 }).state;
      expect(tagTeamCount(second, index)).toBe(2);
      const third = { ...second, phase: 'booster' as const, booster: state.booster };
      expect(() => act(third, { type: 'keepBoosterCard', index: 0 })).toThrow(/tooManyTagTeams/);
    });

    it('peut être refermé sans rien garder', () => {
      const { state } = act(shopRun(4), { type: 'buyBooster', index: 0 });
      const after = act(state, { type: 'skipBooster' }).state;
      expect(after.deck).toHaveLength(20);
      expect(after.phase).toBe('shop');
    });
  });

  describe('booster Énergie', () => {
    it('coûte 4 ₽ et propose 3 énergies de base, dont 1 attachée à une carte', () => {
      const { state } = act(shopRun(4), { type: 'buyBooster', index: 1 });
      expect(state.booster?.energies).toHaveLength(3);
      expect(new Set(state.booster?.energies).size).toBe(3);
      const energy = state.booster?.energies[1];
      const after = act(state, { type: 'keepBoosterEnergy', index: 1, targetUid: 3 }).state;
      expect(after.deck[3]?.energies).toEqual([energy]);
      expect(after.phase).toBe('shop');
    });

    it('ne propose ni Dragon ni Incolore', () => {
      for (let seed = 1; seed <= 100; seed++) {
        const state: RunState = { ...shopRun(4), rng: createRng(seed) };
        const opened = act(state, { type: 'buyBooster', index: 1 }).state;
        expect(opened.booster?.energies).not.toContain('Dragon');
        expect(opened.booster?.energies).not.toContain('Colorless');
      }
    });
  });

  it("les cartes du deck viennent toutes de l'extension", () => {
    const run = createRun(index, { seed: 77 });
    for (const entry of run.deck) expect(() => cardOf(index, entry)).not.toThrow();
  });
});
