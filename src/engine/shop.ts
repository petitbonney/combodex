/** Boutique simplifiée du prototype : cartes et Outils à l'unité, boosters, relance. */
import {
  CARD_PRICES,
  ENERGY_BOOSTER_PRICE,
  ENERGY_BOOSTER_SIZE,
  MAX_TAG_TEAMS,
  RARITY_WEIGHTS,
  REROLL_BASE_COST,
  SET_BOOSTER_PRICE,
  SET_BOOSTER_SIZE,
  SHOP_SLOTS,
  SHOP_TOOL_CHANCE,
  TOOL_PRICES,
  TOOL_RARITY_WEIGHTS,
  TOOL_SLOTS,
  VARIANT_WEIGHTS,
} from '../content/balance.ts';
import { TOOL_OFFERS, TOOLS } from '../content/tools.ts';
import type { CardData, CardIndex, PokemonType, Rarity, Variant } from './cards.ts';
import { cardOf, evolvesFrom } from './cards.ts';
import { nextFloat, pick, sample, weightedPick } from './rng.ts';
import {
  IllegalActionError,
  instanceOf,
  type OpenBooster,
  type RunState,
  type ShopSlot,
  type ShopState,
} from './state.ts';

/** Énergies de base : il n'existe pas d'énergie de base Dragon ni Incolore. */
const BASIC_ENERGIES: readonly PokemonType[] = [
  'Grass',
  'Fire',
  'Water',
  'Lightning',
  'Psychic',
  'Fighting',
  'Darkness',
  'Metal',
  'Fairy',
];

function drawVariant(state: RunState, card: CardData): Variant {
  return weightedPick(
    state.rng,
    card.variants.map((variant) => [variant, VARIANT_WEIGHTS[variant]] as const),
  );
}

function drawCard(state: RunState, pool: readonly CardData[]): CardData {
  const rarities = [...new Set(pool.map((card) => card.rarity))];
  const rarity: Rarity = weightedPick(
    state.rng,
    rarities.map((value) => [value, RARITY_WEIGHTS[value]] as const),
  );
  return pick(
    state.rng,
    pool.filter((card) => card.rarity === rarity),
  );
}

function offerCard(state: RunState, index: CardIndex): ShopSlot {
  // Les TAG TEAM ne sont jamais vendues à l'unité.
  const pool = index.set.cards.filter((card) => !card.isTagTeam);
  const card = drawCard(state, pool);
  return {
    kind: 'card',
    cardId: card.id,
    variant: drawVariant(state, card),
    price: CARD_PRICES[card.rarity],
  };
}

function offerTool(state: RunState, taken: readonly ShopSlot[]): ShopSlot | null {
  const sameOffer =
    (a: { toolId: string; type: PokemonType | null }) =>
    (b: { toolId: string; type: PokemonType | null }) =>
      a.toolId === b.toolId && a.type === b.type;
  const available = TOOL_OFFERS.filter((offer) => {
    const inShop = taken.some((slot) => slot.kind === 'tool' && sameOffer(offer)(slot));
    return !inShop && !state.tools.some(sameOffer(offer));
  });
  if (available.length === 0) return null;
  const rarities = [...new Set(available.map((offer) => TOOLS[offer.toolId].rarity))];
  const rarity = weightedPick(
    state.rng,
    rarities.map((value) => [value, TOOL_RARITY_WEIGHTS[value]] as const),
  );
  const offer = pick(
    state.rng,
    available.filter((candidate) => TOOLS[candidate.toolId].rarity === rarity),
  );
  return { kind: 'tool', ...offer, price: TOOL_PRICES[rarity] };
}

function fillSlots(state: RunState, index: CardIndex): ShopSlot[] {
  const slots: ShopSlot[] = [];
  for (let i = 0; i < SHOP_SLOTS; i++) {
    const tool = nextFloat(state.rng) < SHOP_TOOL_CHANCE ? offerTool(state, slots) : null;
    slots.push(tool ?? offerCard(state, index));
  }
  return slots;
}

export function openShop(state: RunState, index: CardIndex): void {
  const shop: ShopState = {
    slots: fillSlots(state, index),
    boosters: [
      { kind: 'set', price: SET_BOOSTER_PRICE },
      { kind: 'energy', price: ENERGY_BOOSTER_PRICE },
    ],
    rerollCost: REROLL_BASE_COST,
  };
  state.shop = shop;
  state.phase = 'shop';
}

export function requireShop(state: RunState): ShopState {
  if (state.phase !== 'shop' || !state.shop) throw new IllegalActionError('noShop');
  return state.shop;
}

function pay(state: RunState, price: number): void {
  if (state.money < price) throw new IllegalActionError('notEnoughMoney');
  state.money -= price;
}

export function tagTeamCount(state: RunState, index: CardIndex): number {
  return state.deck.filter((card) => cardOf(index, card).isTagTeam).length;
}

/** Ajoute la carte au deck, ou la pose sur une pré-évolution qui garde énergies et variante. */
function addCard(
  state: RunState,
  index: CardIndex,
  cardId: string,
  variant: Variant,
  evolveUid: number | undefined,
): void {
  const card = index.byId.get(cardId);
  if (!card) throw new Error(`Carte inconnue : ${cardId}`);
  if (card.isTagTeam && tagTeamCount(state, index) >= MAX_TAG_TEAMS) {
    throw new IllegalActionError('tooManyTagTeams');
  }
  if (evolveUid === undefined) {
    state.deck.push({ uid: state.nextUid++, cardId, variant, energies: [] });
    return;
  }
  const target = instanceOf(state, evolveUid);
  if (!evolvesFrom(card, cardOf(index, target))) {
    throw new IllegalActionError('invalidEvolution');
  }
  target.cardId = cardId;
}

export function buySlot(
  state: RunState,
  index: CardIndex,
  slotIndex: number,
  evolveUid: number | undefined,
): void {
  const shop = requireShop(state);
  const slot = shop.slots[slotIndex];
  if (!slot) throw new IllegalActionError('emptySlot');
  if (state.money < slot.price) throw new IllegalActionError('notEnoughMoney');
  if (slot.kind === 'card') {
    addCard(state, index, slot.cardId, slot.variant, evolveUid);
  } else {
    if (state.tools.length >= TOOL_SLOTS) throw new IllegalActionError('toolSlotsFull');
    state.tools.push({
      uid: state.nextUid++,
      toolId: slot.toolId,
      type: slot.type,
      price: slot.price,
      stacks: 0,
    });
  }
  state.money -= slot.price;
  shop.slots[slotIndex] = null;
}

export function sellTool(state: RunState, uid: number): void {
  requireShop(state);
  const tool = state.tools.find((candidate) => candidate.uid === uid);
  if (!tool) throw new IllegalActionError('unknownTool');
  state.tools = state.tools.filter((candidate) => candidate !== tool);
  state.money += Math.floor(tool.price / 2);
}

export function reroll(state: RunState, index: CardIndex): void {
  const shop = requireShop(state);
  pay(state, shop.rerollCost);
  shop.rerollCost += 1;
  shop.slots = fillSlots(state, index);
}

function setBooster(state: RunState, index: CardIndex, free: boolean): OpenBooster {
  const cards = Array.from({ length: SET_BOOSTER_SIZE }, () => {
    const card = drawCard(state, index.set.cards);
    return { cardId: card.id, variant: drawVariant(state, card) };
  });
  return { kind: 'set', cards, energies: [], free };
}

export function openFreeBooster(state: RunState, index: CardIndex): void {
  state.booster = setBooster(state, index, true);
  state.phase = 'booster';
}

export function buyBooster(state: RunState, index: CardIndex, boosterIndex: number): void {
  const shop = requireShop(state);
  const booster = shop.boosters[boosterIndex];
  if (!booster) throw new IllegalActionError('boosterSold');
  pay(state, booster.price);
  shop.boosters[boosterIndex] = null;
  state.booster =
    booster.kind === 'set'
      ? setBooster(state, index, false)
      : {
          kind: 'energy',
          cards: [],
          energies: sample(state.rng, BASIC_ENERGIES, ENERGY_BOOSTER_SIZE),
          free: false,
        };
  state.phase = 'booster';
}

export function requireBooster(state: RunState): OpenBooster {
  if (state.phase !== 'booster' || !state.booster) {
    throw new IllegalActionError('noBooster');
  }
  return state.booster;
}

export function keepBoosterCard(
  state: RunState,
  index: CardIndex,
  cardIndex: number,
  evolveUid: number | undefined,
): void {
  const card = requireBooster(state).cards[cardIndex];
  if (!card) throw new IllegalActionError('invalidBoosterChoice');
  addCard(state, index, card.cardId, card.variant, evolveUid);
}

export function keepBoosterEnergy(state: RunState, energyIndex: number, targetUid: number): void {
  const energy = requireBooster(state).energies[energyIndex];
  if (!energy) throw new IllegalActionError('invalidBoosterChoice');
  instanceOf(state, targetUid).energies.push(energy);
}
