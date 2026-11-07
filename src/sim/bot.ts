/**
 * Bot glouton : il joue la main au meilleur score immédiat. Les cartes face cachée restent hors
 * de son calcul tant qu'il a mieux à poser. Simplification : la Brume ne le gêne pas.
 */

import { MAX_TAG_TEAMS, TOOL_SLOTS } from '../content/balance.ts';
import {
  type Action,
  type CardData,
  type CardIndex,
  cardOf,
  evolvesFrom,
  type FightState,
  instanceOf,
  isHidden,
  maxPlayed,
  previewHand,
  type RunState,
  retreatCost,
  tagTeamCount,
} from '../engine/index.ts';

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
  const discard = discardChoice(state, fight, index, hand);
  return discard.length > 0
    ? { type: 'discard', uids: discard }
    : { type: 'play', uids: hand.uids };
}

/** Une carte vaut l'achat si elle fait évoluer une carte du deck ou si elle est forte. */
function evolutionTarget(state: RunState, index: CardIndex, card: CardData): number | undefined {
  return state.deck.find((entry) => evolvesFrom(card, cardOf(index, entry)))?.uid;
}

function shopAction(state: RunState, index: CardIndex): Action {
  const shop = state.shop;
  if (!shop) return { type: 'leaveShop' };
  const toolRoom = state.tools.length < TOOL_SLOTS;
  const affordable = shop.slots.flatMap((slot, position) =>
    slot && slot.price <= state.money ? [{ slot, position }] : [],
  );
  const tool = affordable
    .filter(({ slot }) => slot.kind === 'tool' && toolRoom)
    .sort((a, b) => b.slot.price - a.slot.price)[0];
  if (tool) return { type: 'buySlot', index: tool.position };
  const card = affordable.find(({ slot }) => slot.kind === 'card');
  if (card?.slot.kind === 'card') {
    const data = index.byId.get(card.slot.cardId) as CardData;
    const evolveUid = evolutionTarget(state, index, data);
    if (evolveUid !== undefined) return { type: 'buySlot', index: card.position, evolveUid };
    return { type: 'buySlot', index: card.position };
  }
  const booster = shop.boosters.findIndex(
    (entry) => entry && entry.price <= state.money && (entry.kind !== 'trainer' || toolRoom),
  );
  if (booster >= 0) return { type: 'buyBooster', index: booster };
  return { type: 'leaveShop' };
}

function boosterAction(state: RunState, index: CardIndex): Action {
  const booster = state.booster;
  if (!booster) return { type: 'skipBooster' };
  if (booster.kind === 'energy') {
    const strongest = [...state.deck].sort(
      (a, b) => cardOf(index, b).bestDamage - cardOf(index, a).bestDamage,
    )[0];
    if (!strongest) return { type: 'skipBooster' };
    const shared = booster.energies.findIndex((energy) =>
      state.deck.some((entry) => cardOf(index, entry).types.includes(energy)),
    );
    return { type: 'keepBoosterEnergy', index: Math.max(0, shared), targetUid: strongest.uid };
  }
  if (booster.kind === 'trainer') {
    const priciest = booster.tools
      .map((tool, position) => ({ price: tool.price, position }))
      .sort((a, b) => b.price - a.price)[0];
    return priciest && state.tools.length < TOOL_SLOTS
      ? { type: 'keepBoosterTool', index: priciest.position }
      : { type: 'skipBooster' };
  }
  const tagTeamsFull = tagTeamCount(state, index) >= MAX_TAG_TEAMS;
  const options = booster.cards
    .map((entry, position) => ({ position, data: index.byId.get(entry.cardId) as CardData }))
    .filter(({ data }) => !(data.isTagTeam && tagTeamsFull))
    .sort((a, b) => b.data.bestDamage - a.data.bestDamage);
  const best = options[0];
  return best ? { type: 'keepBoosterCard', index: best.position } : { type: 'skipBooster' };
}

export function chooseAction(state: RunState, index: CardIndex): Action {
  switch (state.phase) {
    case 'intro':
      return { type: 'startFight' };
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
