/**
 * Bot raisonnable. En combat, il joue la main au meilleur score immédiat et défausse quand ses Tours
 * ne suffiront pas ; les cartes face cachée restent hors de son calcul tant qu'il a mieux à poser.
 * En boutique, il estime ses Outils sur des mains tirées de son deck, affine le deck au Centre
 * Pokémon, et pose ses énergies sur ses meilleures cartes. Simplification : la Brume ne le gêne pas.
 */

import { MAX_TAG_TEAMS, MIN_DECK_SIZE } from '../content/balance.ts';
import { ACE_SPECS } from '../content/consumables.ts';
import type { ToolInstance } from '../content/tools.ts';
import {
  type Action,
  type CardData,
  type CardIndex,
  type CardInstance,
  cardOf,
  evolvesFrom,
  type FightState,
  instanceOf,
  isHidden,
  leapTarget,
  maxPlayed,
  type OpenBooster,
  previewHand,
  type RunState,
  retreatCost,
  tagTeamCount,
} from '../engine/index.ts';
import { isStadium, type Sample, sampleDeck, toolsetValue, trialTool } from './valuation.ts';

function combinations(items: readonly number[], maxSize: number): number[][] {
  const results: number[][] = [];
  const walk = (start: number, current: number[]) => {
    if (current.length > 0) results.push(current);
    if (current.length === maxSize) return;
    for (let i = start; i < items.length; i++) {
      walk(i + 1, [...current, items[i] as number]);
    }
  };
  walk(0, []);
  return results;
}

interface BestHand {
  uids: number[];
  value: number;
}

function bestHand(state: RunState, fight: FightState, index: CardIndex): BestHand {
  const playable = fight.hand.filter((uid) => !fight.paralyzedUids.includes(uid));
  const forced = fight.forcedUids;
  const known = playable.filter((uid) => !isHidden(fight, uid) && !forced.includes(uid));
  const room = maxPlayed(state, fight) - forced.length;
  const picks = [[], ...combinations(known, room)].map((uids) => [...forced, ...uids]);
  let best: BestHand = { uids: [], value: -1 };
  for (const uids of picks) {
    if (uids.length === 0) continue;
    const preview = previewHand(state, index, uids);
    const value = preview.score + preview.flatDamage;
    if (value > best.value) best = { uids, value };
  }
  if (best.uids.length > 0) return best;
  // Toute la main est cachée : il pose une carte à l'aveugle.
  return { uids: playable.slice(0, 1), value: 0 };
}

function discardChoice(
  state: RunState,
  fight: FightState,
  index: CardIndex,
  hand: BestHand,
): number[] {
  if (fight.drawPile.length === 0 || fight.retreatPoints === 0) return [];
  const turnsLeft = fight.maxTurns - fight.turn + 1;
  if (hand.value * turnsLeft >= fight.opponent.hp) return [];
  const spare = fight.hand
    .filter((uid) => !hand.uids.includes(uid) && !fight.forcedUids.includes(uid))
    .map((uid) => ({ uid, cost: retreatCost(state, fight, index, uid) }))
    .sort((a, b) => a.cost - b.cost);
  const chosen: number[] = [];
  let budget = fight.retreatPoints;
  for (const { uid, cost } of spare) {
    if (cost > budget) break;
    chosen.push(uid);
    budget -= cost;
  }
  return chosen;
}

/** Les ACE SPEC de combat servent dès que le combat s'annonce mal. */
function fightAce(state: RunState, fight: FightState, hand: BestHand): Action | null {
  const ace = state.aceSpec;
  if (!ace) return null;
  const { timing } = ACE_SPECS[ace];
  if (timing === 'outsideFight') return null;
  if (ace === 'jackpot') return { type: 'useAce' };
  const turnsLeft = fight.maxTurns - fight.turn + 1;
  const behind = hand.value * turnsLeft < fight.opponent.hp;
  if (ace === 'secondWind') return turnsLeft === 1 && behind ? { type: 'useAce' } : null;
  return behind ? { type: 'useAce' } : null;
}

function fightAction(state: RunState, fight: FightState, index: CardIndex): Action {
  if (fight.searchChoices) {
    const strongest = [...fight.searchChoices].sort(
      (a, b) =>
        cardOf(index, instanceOf(state, b)).bestDamage -
        cardOf(index, instanceOf(state, a)).bestDamage,
    )[0] as number;
    return { type: 'resolveSearch', uid: strongest };
  }
  const hand = bestHand(state, fight, index);
  if (hand.value >= fight.opponent.hp) return { type: 'play', uids: hand.uids };
  const ace = fightAce(state, fight, hand);
  if (ace) return ace;
  const discard = discardChoice(state, fight, index, hand);
  return discard.length > 0
    ? { type: 'discard', uids: discard }
    : { type: 'play', uids: hand.uids };
}

/** Gain minimal d'un Outil pour l'acheter, et pour remplacer un Outil en place. */
const BUY_GAIN = 1.04;
const SWAP_GAIN = 1.2;
const MAX_REROLL_COST = 7;
/** Sous ce deck, le bot n'enlève plus de cartes. */
const LEAN_DECK = 16;

function strength(index: CardIndex, card: CardInstance): number {
  const data = cardOf(index, card);
  return data.bestDamage + 10 * card.energies.length + (card.variant === 'normal' ? 0 : 60);
}

function strongestCard(state: RunState, index: CardIndex): CardInstance | undefined {
  return [...state.deck].sort((a, b) => strength(index, b) - strength(index, a))[0];
}

/** Le type le plus présent du deck. */
function mainType(state: RunState, index: CardIndex): string | undefined {
  const counts = new Map<string, number>();
  for (const card of state.deck) {
    for (const type of cardOf(index, card).types) counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** La carte la moins utile : faible, sans lignée dans le deck, hors du type principal. */
function weakestCard(state: RunState, index: CardIndex): CardInstance | undefined {
  const main = mainType(state, index);
  const worth = (card: CardInstance) => {
    const data = cardOf(index, card);
    const linked = state.deck.some((other) => {
      const otherData = cardOf(index, other);
      return evolvesFrom(otherData, data) || evolvesFrom(data, otherData);
    });
    const twins = state.deck.filter((other) => other.cardId === card.cardId).length;
    const onType = main !== undefined && data.types.some((type) => type === main);
    return strength(index, card) + (linked ? 80 : 0) + 40 * (twins - 1) + (onType ? 50 : 0);
  };
  return [...state.deck].sort((a, b) => worth(a) - worth(b))[0];
}

function outsideAce(state: RunState, index: CardIndex): Action | null {
  const ace = state.aceSpec;
  if (!ace) return null;
  const def = ACE_SPECS[ace];
  if (def.timing === 'fight') return null;
  if (ace === 'bigCleanup') {
    if (state.deck.length - def.targets < MIN_DECK_SIZE) return null;
    const worst = [...state.deck].sort((a, b) => strength(index, a) - strength(index, b));
    return { type: 'useAce', targetUids: worst.slice(0, def.targets).map((card) => card.uid) };
  }
  if (def.targets === 0) return { type: 'useAce' };
  const pool = state.deck.filter((card) => !cardOf(index, card).isTagTeam);
  const best = [...pool].sort((a, b) => strength(index, b) - strength(index, a))[0];
  return best ? { type: 'useAce', targetUids: [best.uid] } : null;
}

function evolutionTarget(state: RunState, index: CardIndex, card: CardData): number | undefined {
  return state.deck.find((entry) => evolvesFrom(card, cardOf(index, entry)))?.uid;
}

interface ToolOffer {
  action: Action;
  sellUid: number | null;
}

/** Le meilleur Outil à acheter parmi la vitrine, avec celui à revendre pour lui faire de la place. */
function bestToolOffer(state: RunState, index: CardIndex, deck: Sample): ToolOffer | null {
  const shop = state.shop;
  if (!shop) return null;
  const current = toolsetValue(state, index, deck, state.tools);
  let best: (ToolOffer & { gain: number }) | null = null;
  shop.slots.forEach((slot, position) => {
    if (slot?.kind !== 'tool' || slot.price > state.money) return;
    const trial = trialTool(slot);
    const rivalStadium = state.tools.find((tool) => isStadium(tool.toolId));
    const replaced: ToolInstance | undefined = isStadium(slot.toolId) ? rivalStadium : undefined;
    const kept = state.tools.filter((tool) => tool !== replaced);
    const room = kept.length < state.toolSlots;
    const candidates = room
      ? [{ tools: [...kept, trial], sellUid: null as number | null }]
      : kept.map((tool) => ({
          tools: [...kept.filter((other) => other !== tool), trial],
          sellUid: tool.uid as number | null,
        }));
    for (const { tools, sellUid } of candidates) {
      const gain = toolsetValue(state, index, deck, tools) / Math.max(1, current);
      const needed = sellUid === null ? BUY_GAIN : SWAP_GAIN;
      if (gain >= needed && gain > (best?.gain ?? 0)) {
        best = { action: { type: 'buySlot', index: position }, sellUid, gain };
      }
    }
  });
  return best;
}

function consumableAction(state: RunState, index: CardIndex): Action | null {
  const consumable = state.shop?.consumable;
  if (!consumable || consumable.price > state.money) return null;
  if (consumable.kind === 'ace') return state.aceSpec ? null : { type: 'buyConsumable' };
  if (consumable.kind === 'leap') {
    const target = state.deck.find((card) => leapTarget(index, cardOf(index, card)) !== null);
    return target ? { type: 'buyConsumable', targetUid: target.uid } : null;
  }
  const best = strongestCard(state, index);
  return best ? { type: 'buyConsumable', targetUid: best.uid } : null;
}

function cardAction(state: RunState, index: CardIndex): Action | null {
  const shop = state.shop;
  if (!shop) return null;
  const main = mainType(state, index);
  for (const [position, slot] of shop.slots.entries()) {
    if (slot?.kind !== 'card' || slot.price > state.money) continue;
    const data = index.byId.get(slot.cardId) as CardData;
    const evolveUid = evolutionTarget(state, index, data);
    if (evolveUid !== undefined) return { type: 'buySlot', index: position, evolveUid };
    const twin = state.deck.some((card) => cardOf(index, card).dexIds[0] === data.dexIds[0]);
    const onType = data.types.some((type) => type === main);
    if ((twin || onType) && data.bestDamage >= 60) return { type: 'buySlot', index: position };
  }
  return null;
}

function boosterBuy(state: RunState): Action | null {
  const shop = state.shop;
  if (!shop) return null;
  const order = ['premium', 'trainer', 'set', 'energy'];
  const room = state.tools.length < state.toolSlots;
  const ranked = shop.boosters
    .flatMap((entry, position) => (entry ? [{ entry, position }] : []))
    .filter(({ entry }) => entry.price <= state.money && (entry.kind !== 'trainer' || room))
    .sort((a, b) => order.indexOf(a.entry.kind) - order.indexOf(b.entry.kind));
  const first = ranked[0];
  return first ? { type: 'buyBooster', index: first.position } : null;
}

function shopAction(state: RunState, index: CardIndex): Action {
  const shop = state.shop;
  if (!shop) return { type: 'leaveShop' };
  const ace = outsideAce(state, index);
  if (ace) return ace;
  if (!state.arenaCenterUsed && state.deck.length > LEAN_DECK) {
    const worst = weakestCard(state, index);
    if (worst) return { type: 'removeCard', uid: worst.uid };
  }
  const offer = bestToolOffer(state, index, sampleDeck(state, index));
  if (offer) {
    return offer.sellUid === null ? offer.action : { type: 'sellTool', uid: offer.sellUid };
  }
  const next = consumableAction(state, index) ?? cardAction(state, index) ?? boosterBuy(state);
  if (next) return next;
  const room = state.tools.length < state.toolSlots;
  const reroll = room && shop.rerollCost <= MAX_REROLL_COST && state.money >= shop.rerollCost;
  return reroll ? { type: 'reroll' } : { type: 'leaveShop' };
}

function keepTool(state: RunState, index: CardIndex, booster: OpenBooster): Action {
  const room = state.tools.length < state.toolSlots;
  const deck = sampleDeck(state, index);
  const ranked = booster.tools
    .map((tool, position) => {
      const value = toolsetValue(state, index, deck, [...state.tools, trialTool(tool)]);
      const blocked = !room && !isStadium(tool.toolId);
      return { position, value, blocked };
    })
    .filter(({ blocked }) => !blocked)
    .sort((a, b) => b.value - a.value);
  const best = ranked[0];
  return best ? { type: 'keepBoosterTool', index: best.position } : { type: 'skipBooster' };
}

function boosterAction(state: RunState, index: CardIndex): Action {
  const booster = state.booster;
  if (!booster) return { type: 'skipBooster' };
  if (booster.kind === 'energy') {
    const strongest = strongestCard(state, index);
    if (!strongest) return { type: 'skipBooster' };
    const shared = booster.energies.findIndex((energy) =>
      state.deck.some((entry) => cardOf(index, entry).types.includes(energy)),
    );
    return { type: 'keepBoosterEnergy', index: Math.max(0, shared), targetUid: strongest.uid };
  }
  if (booster.kind === 'trainer') return keepTool(state, index, booster);
  const tagTeamsFull = tagTeamCount(state, index) >= MAX_TAG_TEAMS;
  const main = mainType(state, index);
  const worth = (data: CardData, variant: string) =>
    data.bestDamage +
    (data.types.some((type) => type === main) ? 40 : 0) +
    (evolutionTarget(state, index, data) === undefined ? 0 : 100) +
    (variant === 'normal' ? 0 : 60);
  const options = booster.cards
    .map((entry, position) => ({
      position,
      data: index.byId.get(entry.cardId) as CardData,
      variant: entry.variant,
    }))
    .filter(({ data }) => !(data.isTagTeam && tagTeamsFull))
    .sort((a, b) => worth(b.data, b.variant) - worth(a.data, a.variant));
  const best = options[0];
  if (!best) return { type: 'skipBooster' };
  const evolveUid = evolutionTarget(state, index, best.data);
  return {
    type: 'keepBoosterCard',
    index: best.position,
    ...(evolveUid === undefined ? {} : { evolveUid }),
  };
}

export function chooseAction(state: RunState, index: CardIndex): Action {
  switch (state.phase) {
    case 'intro': {
      const ace = outsideAce(state, index);
      return ace ?? { type: 'startFight' };
    }
    case 'fight':
      if (!state.fight) throw new Error('Combat manquant');
      return fightAction(state, state.fight, index);
    case 'shop':
      return shopAction(state, index);
    case 'booster':
      return boosterAction(state, index);
    case 'won':
    case 'lost':
      throw new Error('La run est terminée');
  }
}
