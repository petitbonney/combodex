/** Boutique : cartes et Outils à l'unité, boosters, consommable, relance, revente, Centre Pokémon. */
import {
  BOOSTER_WEIGHTS,
  CARD_PRICES,
  CONSUMABLE_PRICES,
  CONSUMABLE_WEIGHTS,
  ENERGY_BOOSTER_PRICE,
  ENERGY_BOOSTER_SIZE,
  MAX_TAG_TEAMS,
  MIN_DECK_SIZE,
  PREMIUM_BOOSTER_KEEPS,
  PREMIUM_BOOSTER_PRICE,
  PREMIUM_BOOSTER_SIZE,
  RARITY_WEIGHTS,
  REROLL_BASE_COST,
  SET_BOOSTER_PRICE,
  SET_BOOSTER_SIZE,
  SHOP_BOOSTERS,
  SHOP_SLOTS,
  SHOP_TOOL_CHANCE,
  TOOL_PRICES,
  TOOL_RARITY_WEIGHTS,
  TRAINER_BOOSTER_PRICE,
  TRAINER_BOOSTER_SIZE,
  VARIANT_WEIGHTS,
} from '../content/balance.ts';
import { ACE_SPEC_IDS, SPECIAL_ENERGY_IDS } from '../content/consumables.ts';
import { TOOL_OFFERS, TOOLS, type ToolDef, type ToolId } from '../content/tools.ts';
import type { CardData, CardIndex, PokemonType, Rarity, Variant } from './cards.ts';
import { cardOf, evolvesFrom } from './cards.ts';
import { nextFloat, pick, sample, weightedPick } from './rng.ts';
import {
  type BoosterKind,
  IllegalActionError,
  instanceOf,
  type OpenBooster,
  type RunState,
  type ShopBooster,
  type ShopConsumable,
  type ShopSlot,
  type ShopState,
  type ShopToolSlot,
} from './state.ts';

const BOOSTER_PRICES: Record<BoosterKind, number> = {
  set: SET_BOOSTER_PRICE,
  energy: ENERGY_BOOSTER_PRICE,
  trainer: TRAINER_BOOSTER_PRICE,
  premium: PREMIUM_BOOSTER_PRICE,
};

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

function offerTool(state: RunState, taken: readonly ShopSlot[]): ShopToolSlot | null {
  const sameOffer =
    (a: { toolId: string; type: PokemonType | null }) =>
    (b: { toolId: string; type: PokemonType | null }) =>
      a.toolId === b.toolId && a.type === b.type;
  const available = TOOL_OFFERS.filter((offer) => {
    if (state.lockedTools.includes(offer.toolId)) return false;
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

function discount(state: RunState, read: (def: ToolDef) => number | undefined): number {
  return state.tools.reduce((sum, tool) => sum + (read(TOOLS[tool.toolId]) ?? 0), 0);
}

function drawConsumable(state: RunState): ShopConsumable {
  const kinds = Object.keys(CONSUMABLE_WEIGHTS) as ShopConsumable['kind'][];
  const kind = weightedPick(
    state.rng,
    kinds.map((value) => [value, CONSUMABLE_WEIGHTS[value]] as const),
  );
  const price = CONSUMABLE_PRICES[kind];
  switch (kind) {
    case 'energy':
      return { kind, energy: pick(state.rng, BASIC_ENERGIES), price };
    case 'special':
      return { kind, special: pick(state.rng, SPECIAL_ENERGY_IDS), price };
    case 'leap':
      return { kind, price };
    case 'ace':
      return { kind, ace: pick(state.rng, ACE_SPEC_IDS), price };
  }
}

/** Des boosters tous différents, tirés selon leurs poids. */
function drawBoosters(state: RunState): ShopBooster[] {
  const kinds = Object.keys(BOOSTER_WEIGHTS) as BoosterKind[];
  const boosters: ShopBooster[] = [];
  while (boosters.length < SHOP_BOOSTERS) {
    const remaining = kinds.filter((kind) => !boosters.some((entry) => entry.kind === kind));
    const kind = weightedPick(
      state.rng,
      remaining.map((value) => [value, BOOSTER_WEIGHTS[value]] as const),
    );
    const reduced = BOOSTER_PRICES[kind] - discount(state, (def) => def.boosterDiscount);
    boosters.push({ kind, price: Math.max(1, reduced) });
  }
  return boosters;
}

export function openShop(state: RunState, index: CardIndex): void {
  const shop: ShopState = {
    slots: fillSlots(state, index),
    boosters: drawBoosters(state),
    consumable: drawConsumable(state),
    rerollCost: Math.max(1, REROLL_BASE_COST - discount(state, (def) => def.rerollDiscount)),
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

/** Un nouveau Stade prend la place de l'ancien, sans remboursement ; sinon il faut une place. */
function addTool(
  state: RunState,
  offer: { toolId: ToolId; type: PokemonType | null; price: number },
): void {
  const instance = { uid: state.nextUid, ...offer, stacks: 0 };
  const replaced = TOOLS[offer.toolId].stadium
    ? state.tools.findIndex((tool) => TOOLS[tool.toolId].stadium)
    : -1;
  if (replaced < 0 && state.tools.length >= state.toolSlots) {
    throw new IllegalActionError('toolSlotsFull');
  }
  state.nextUid += 1;
  if (replaced >= 0) state.tools[replaced] = instance;
  else state.tools.push(instance);
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
    addTool(state, { toolId: slot.toolId, type: slot.type, price: slot.price });
  }
  state.money -= slot.price;
  shop.slots[slotIndex] = null;
}

/** La revente reste possible pendant l'ouverture d'un booster acheté, pour libérer un emplacement. */
export function sellTool(state: RunState, uid: number): void {
  if (!state.shop || (state.phase !== 'shop' && state.phase !== 'booster')) {
    throw new IllegalActionError('noShop');
  }
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
  return { kind: 'set', cards, energies: [], tools: [], keeps: 1, free };
}

/** Le dernier Pokémon est une holo garantie, tirée parmi les cartes qui existent en holo. */
function premiumBooster(state: RunState, index: CardIndex): OpenBooster {
  const cards = Array.from({ length: PREMIUM_BOOSTER_SIZE - 1 }, () => {
    const card = drawCard(state, index.set.cards);
    return { cardId: card.id, variant: drawVariant(state, card) };
  });
  const holos = index.set.cards.filter((card) => card.variants.includes('holo'));
  cards.push({ cardId: drawCard(state, holos).id, variant: 'holo' });
  return {
    kind: 'premium',
    cards,
    energies: [],
    tools: [],
    keeps: PREMIUM_BOOSTER_KEEPS,
    free: false,
  };
}

function trainerBooster(state: RunState, shop: ShopState): OpenBooster {
  const taken = shop.slots.filter((slot) => slot !== null);
  const tools: ShopToolSlot[] = [];
  for (let i = 0; i < TRAINER_BOOSTER_SIZE; i++) {
    const tool = offerTool(state, [...taken, ...tools]);
    if (tool) tools.push(tool);
  }
  return {
    kind: 'trainer',
    cards: [],
    energies: [],
    tools: tools.map(({ toolId, type, price }) => ({ toolId, type, price })),
    keeps: 1,
    free: false,
  };
}

function energyBooster(state: RunState): OpenBooster {
  return {
    kind: 'energy',
    cards: [],
    energies: sample(state.rng, BASIC_ENERGIES, ENERGY_BOOSTER_SIZE),
    tools: [],
    keeps: 1,
    free: false,
  };
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
  const open = {
    set: () => setBooster(state, index, false),
    energy: () => energyBooster(state),
    trainer: () => trainerBooster(state, shop),
    premium: () => premiumBooster(state, index),
  };
  state.booster = open[booster.kind]();
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
  const booster = requireBooster(state);
  const card = booster.cards[cardIndex];
  if (!card) throw new IllegalActionError('invalidBoosterChoice');
  addCard(state, index, card.cardId, card.variant, evolveUid);
  booster.cards.splice(cardIndex, 1);
}

export function keepBoosterEnergy(state: RunState, energyIndex: number, targetUid: number): void {
  const energy = requireBooster(state).energies[energyIndex];
  if (!energy) throw new IllegalActionError('invalidBoosterChoice');
  instanceOf(state, targetUid).energies.push(energy);
}

export function keepBoosterTool(state: RunState, toolIndex: number): void {
  const tool = requireBooster(state).tools[toolIndex];
  if (!tool) throw new IllegalActionError('invalidBoosterChoice');
  addTool(state, tool);
}

/** Le Niveau 2 qu'une Base peut devenir d'un coup ; celui de la carte, s'il y en a plusieurs. */
export function leapTarget(index: CardIndex, card: CardData): CardData | null {
  if (card.stage !== 'Basic') return null;
  const middles = index.set.cards.filter((other) => evolvesFrom(other, card));
  for (const middle of middles) {
    const top = index.set.cards.find((other) => evolvesFrom(other, middle));
    if (top) return top;
  }
  return null;
}

function applyConsumable(
  state: RunState,
  index: CardIndex,
  consumable: ShopConsumable,
  targetUid: number | undefined,
): void {
  if (consumable.kind === 'ace') {
    if (state.aceSpec) throw new IllegalActionError('aceReserveFull');
    state.aceSpec = consumable.ace;
    return;
  }
  if (targetUid === undefined) throw new IllegalActionError('invalidTarget');
  const target = instanceOf(state, targetUid);
  if (consumable.kind === 'energy') {
    target.energies.push(consumable.energy);
  } else if (consumable.kind === 'special') {
    target.specials = [...(target.specials ?? []), consumable.special];
  } else {
    const top = leapTarget(index, cardOf(index, target));
    if (!top) throw new IllegalActionError('invalidEvolution');
    target.cardId = top.id;
  }
}

export function buyConsumable(
  state: RunState,
  index: CardIndex,
  targetUid: number | undefined,
): void {
  const shop = requireShop(state);
  const { consumable } = shop;
  if (!consumable) throw new IllegalActionError('emptySlot');
  if (state.money < consumable.price) throw new IllegalActionError('notEnoughMoney');
  applyConsumable(state, index, consumable, targetUid);
  state.money -= consumable.price;
  shop.consumable = null;
}

/** Retire une carte du deck : une fois par Arène, sans descendre sous une main. */
export function removeCard(state: RunState, uid: number): void {
  requireShop(state);
  if (state.arenaCenterUsed) throw new IllegalActionError('centerUsed');
  if (state.deck.length <= MIN_DECK_SIZE) throw new IllegalActionError('deckTooSmall');
  instanceOf(state, uid);
  state.deck = state.deck.filter((card) => card.uid !== uid);
  state.arenaBanishedUids = state.arenaBanishedUids.filter((other) => other !== uid);
  state.arenaCenterUsed = true;
}
