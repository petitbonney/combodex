/** Déroulé d'un combat. Ces fonctions modifient une copie de l'état préparée par `applyAction`. */
import {
  AFFLICTION_PERCENT,
  ELECTRIC_TURNS,
  HAND_SIZE,
  INTEREST_CAP,
  INTEREST_STEP,
  MAX_PLAYED,
  MAX_TURNS,
  PLANT_HEAL_PERCENT,
  PSYCHIC_FACE_DOWN_CHANCE,
  RETREAT_POINTS,
  REWARD_MONEY,
  SCOUT_DEPTH,
  SEARCH_DEPTH,
  STRONG_STATUS_ARENA_INDEX,
  UNUSED_TURN_MONEY,
  WIN_MONEY,
} from '../content/balance.ts';
import { STATUS_IDS, STATUSES, type StatusId, statusesOfType } from '../content/statuses.ts';
import { TOOLS, type ToolDef } from '../content/tools.ts';
import type { CardData, CardIndex } from './cards.ts';
import { cardOf, evolvesFrom, POKEMON_TYPES } from './cards.ts';
import { coinFlip, nextFloat, pick, rollDie, sample, shuffle } from './rng.ts';
import { currentRules, permanentType } from './rules.ts';
import {
  activeTools,
  hasSpecial,
  type ScoreInput,
  type ScoreResult,
  scoreHand,
} from './scoring.ts';
import {
  type FightGains,
  type FightState,
  type GameEvent,
  IllegalActionError,
  instanceOf,
  type Opponent,
  type RunState,
} from './state.ts';

type Events = GameEvent[];

export function requireFight(state: RunState): FightState {
  if (state.phase !== 'fight' || !state.fight) {
    throw new IllegalActionError('noFight');
  }
  return state.fight;
}

/** Les statuts passent en version renforcée à partir de l'Arène 5. */
export function isStrong(state: RunState): boolean {
  return state.arenaIndex >= STRONG_STATUS_ARENA_INDEX;
}

function hasPermanent(fight: FightState, type: Opponent['type']): boolean {
  return permanentType(fight.opponent) === type;
}

/** Somme d'un bonus d'Outil, sans ceux que le combat a désactivés. */
function toolBonus(
  state: RunState,
  disabled: readonly number[],
  read: (def: ToolDef) => number | undefined,
): number {
  return state.tools
    .filter((tool) => !disabled.includes(tool.uid))
    .reduce((sum, tool) => sum + (read(TOOLS[tool.toolId]) ?? 0), 0);
}

function drawCard(state: RunState, fight: FightState): number | null {
  const uid = fight.drawPile.shift();
  if (uid === undefined) return null;
  fight.hand.push(uid);
  if (hasPermanent(fight, 'Psychic') && nextFloat(state.rng) < PSYCHIC_FACE_DOWN_CHANCE) {
    fight.faceDownUids.push(uid);
  }
  return uid;
}

function drawCards(state: RunState, fight: FightState, count: number): void {
  for (let i = 0; i < count; i++) drawCard(state, fight);
}

function refillHand(state: RunState, fight: FightState): void {
  const { handLimit } = currentRules(fight);
  drawCards(state, fight, handLimit + fight.handBonus - fight.hand.length);
}

function removeFromHand(fight: FightState, uids: readonly number[]): void {
  fight.hand = fight.hand.filter((uid) => !uids.includes(uid));
  fight.faceDownUids = fight.faceDownUids.filter((uid) => !uids.includes(uid));
}

function returnToDeck(state: RunState, fight: FightState, uids: readonly number[]): void {
  removeFromHand(fight, uids);
  fight.drawPile = shuffle(state.rng, [...fight.drawPile, ...uids]);
}

/** Le Maître de la Ligue tire parmi tous les types ; les Champions, parmi ceux de leur Arène. */
function drawAnnouncement(state: RunState, fight: FightState): StatusId {
  const { kind, type } = fight.opponent;
  return pick(state.rng, kind === 'league' ? STATUS_IDS : statusesOfType(type));
}

/** Pile ou face et dé 1 à 3 : 50 % ; dé 1 à 4 : 67 % (dé à 6 faces). */
function rollStatus(state: RunState, id: StatusId): { success: boolean; rolled: number | null } {
  const { roll } = STATUSES[id];
  if (roll === 'none') return { success: true, rolled: null };
  if (roll === 'coin') return { success: coinFlip(state.rng), rolled: null };
  const rolled = rollDie(state.rng, 6);
  return { success: rolled <= (roll === 'die3' ? 3 : 4), rolled };
}

function healOpponent(fight: FightState, amount: number, events: Events): void {
  const { opponent } = fight;
  const healed = Math.min(amount, opponent.maxHp - opponent.hp);
  opponent.hp += healed;
  if (healed > 0) events.push({ type: 'opponentHealed', amount: healed });
}

/** Effets d'un statut réussi sur la main, les PV ou les ressources. */
function applyStatusStart(
  state: RunState,
  fight: FightState,
  id: StatusId,
  strong: boolean,
  events: Events,
): void {
  const def = STATUSES[id];
  const value = strong ? def.strong : def.base;
  const { rng } = state;
  switch (id) {
    case 'photosynthesis':
      healOpponent(fight, Math.floor(fight.opponent.maxHp * value), events);
      break;
    case 'vines': {
      const excess = fight.hand.length - value - fight.handBonus;
      if (excess > 0) {
        const uids = sample(rng, fight.hand, excess);
        returnToDeck(state, fight, uids);
        events.push({ type: 'handReturned', uids });
      }
      break;
    }
    case 'burn': {
      if (fight.hand.length === 0) break;
      const uid = pick(rng, fight.hand);
      removeFromHand(fight, [uid]);
      if (strong) state.arenaBanishedUids.push(uid);
      else fight.discardPile.push(uid);
      events.push({ type: 'handBurned', uid, banished: strong });
      break;
    }
    case 'tide': {
      const uids = sample(rng, fight.hand, value);
      returnToDeck(state, fight, uids);
      drawCards(state, fight, uids.length);
      events.push({ type: 'handReturned', uids });
      break;
    }
    case 'current': {
      const lost = Math.min(value, fight.retreatPoints);
      fight.retreatPoints -= lost;
      events.push({ type: 'retreatLost', amount: lost });
      break;
    }
    case 'paralysis':
      // Une carte au moins reste jouable.
      fight.paralyzedUids = sample(rng, fight.hand, Math.min(value, fight.hand.length - 1));
      break;
    case 'hypnosis':
      fight.hypnotizedUids = sample(rng, fight.hand, value);
      break;
    case 'poison':
      fight.poisonPercent = Math.min(1, fight.poisonPercent + value);
      break;
    case 'theft': {
      const lost = Math.min(value, state.money);
      state.money -= lost;
      events.push({ type: 'moneyLost', amount: lost });
      break;
    }
    case 'ambush':
      fight.turnDisabledToolUids = sample(
        rng,
        state.tools.map((tool) => tool.uid),
        value,
      );
      break;
    case 'attract': {
      const free = fight.hand.filter((uid) => !fight.paralyzedUids.includes(uid));
      fight.forcedUids = sample(rng, free, value);
      break;
    }
    default:
      break;
  }
}

function resolveAnnouncedStatus(
  state: RunState,
  fight: FightState,
  announced: StatusId,
  events: Events,
): void {
  const { success: rollSuccess, rolled } = rollStatus(state, announced);
  const warded = toolBonus(state, disabledToolUids(fight), (def) => (def.statusWard ? 1 : 0)) > 0;
  const success = rollSuccess && !(warded && coinFlip(state.rng));
  events.push({ type: 'statusRolled', id: announced, success, rolled });
  if (!success) return;
  let id = announced;
  if (announced === 'mimic') {
    const others = STATUS_IDS.filter((other) => STATUSES[other].type !== 'Colorless');
    id = pick(state.rng, others);
    events.push({ type: 'statusCopied', id });
  }
  fight.activeStatus = { id, strong: isStrong(state), sourceId: announced };
}

function openSearch(fight: FightState): void {
  if (fight.pendingSearches <= 0 || fight.drawPile.length === 0) {
    fight.pendingSearches = 0;
    fight.searchChoices = null;
    return;
  }
  fight.pendingSearches -= 1;
  fight.searchChoices = fight.drawPile.slice(0, SEARCH_DEPTH);
}

function beginTurn(state: RunState, fight: FightState, events: Events): void {
  fight.turn += 1;
  fight.activeStatus = null;
  fight.hypnotizedUids = [];
  fight.paralyzedUids = [];
  fight.forcedUids = [];
  fight.turnDisabledToolUids = [];
  events.push({ type: 'turnStarted', turn: fight.turn });

  if (fight.opponent.kind === 'league') {
    const weakness = pick(
      state.rng,
      POKEMON_TYPES.filter((type) => type !== 'Colorless'),
    );
    fight.opponent.weaknesses = [weakness];
    events.push({ type: 'weaknessChanged', weakness });
  }

  const announced = fight.announcedStatus;
  fight.announcedStatus = null;
  if (fight.opponent.form === 'statuses' && fight.turn < fight.maxTurns) {
    fight.announcedStatus = drawAnnouncement(state, fight);
    events.push({ type: 'statusAnnounced', id: fight.announcedStatus });
  }
  if (announced) resolveAnnouncedStatus(state, fight, announced, events);

  if (hasPermanent(fight, 'Grass')) {
    healOpponent(fight, Math.floor(fight.opponent.maxHp * PLANT_HEAL_PERCENT), events);
  }
  refillHand(state, fight);
  if (fight.activeStatus) {
    const { id, strong } = fight.activeStatus;
    applyStatusStart(state, fight, id, strong, events);
  }
  drawCards(state, fight, fight.extraDraw);
  fight.extraDraw = 0;
  openSearch(fight);
}

export function startFight(state: RunState, opponent: Opponent, events: Events): void {
  const banished = new Set(state.arenaBanishedUids);
  const uids = state.deck.map((card) => card.uid).filter((uid) => !banished.has(uid));
  const fight: FightState = {
    opponent,
    drawPile: shuffle(state.rng, uids),
    hand: [],
    discardPile: [],
    turn: 0,
    maxTurns: MAX_TURNS,
    retreatPoints: RETREAT_POINTS,
    announcedStatus: null,
    activeStatus: null,
    poisonPercent: 0,
    afflicted: false,
    extraDraw: 0,
    pendingSearches: 0,
    searchChoices: null,
    swappedUids: [],
    faceDownUids: [],
    hypnotizedUids: [],
    paralyzedUids: [],
    forcedUids: [],
    turnDisabledToolUids: [],
    fightDisabledToolUids: [],
    handBonus: 0,
  };
  state.fight = fight;
  state.phase = 'fight';
  events.push({ type: 'fightStarted', opponent });

  if (hasPermanent(fight, 'Lightning')) fight.maxTurns = ELECTRIC_TURNS;
  if (hasPermanent(fight, 'Darkness') && state.tools.length > 0) {
    fight.fightDisabledToolUids = [pick(state.rng, state.tools).uid];
  }
  const disabled = fight.fightDisabledToolUids;
  fight.maxTurns += toolBonus(state, disabled, (def) => def.extraTurns);
  fight.retreatPoints += toolBonus(state, disabled, (def) => def.extraRetreat);
  fight.handBonus = toolBonus(state, disabled, (def) => def.handBonus);
  drawCards(state, fight, HAND_SIZE + fight.handBonus);
  if (opponent.form === 'statuses') {
    fight.announcedStatus = drawAnnouncement(state, fight);
    events.push({ type: 'statusAnnounced', id: fight.announcedStatus });
  }
  beginTurn(state, fight, events);
}

function disabledToolUids(fight: FightState): number[] {
  return [...fight.fightDisabledToolUids, ...fight.turnDisabledToolUids];
}

/** Nombre maximum de cartes posées à ce Tour. */
export function maxPlayed(state: RunState, fight: FightState): number {
  const tools = activeTools({
    tools: state.tools,
    disabledToolUids: disabledToolUids(fight),
    rules: currentRules(fight),
  });
  return Math.max(MAX_PLAYED, ...tools.map((tool) => TOOLS[tool.toolId].maxPlayed ?? 0));
}

/** Coût de retraite d'une carte en main, avec Racines et Agilité. */
export function retreatCost(
  state: RunState,
  fight: FightState,
  index: CardIndex,
  uid: number,
): number {
  const agility = fight.hand.filter(
    (other) => cardOf(index, instanceOf(state, other)).abilityFamily === 'agility',
  ).length;
  const { retreatCostBonus } = currentRules(fight);
  const instance = instanceOf(state, uid);
  if (hasSpecial(instance, 'light')) return 0;
  const printed = cardOf(index, instance).retreat;
  return Math.max(0, printed + retreatCostBonus - agility);
}

/** Vrai si le joueur ne voit pas la carte. */
export function isHidden(fight: FightState, uid: number): boolean {
  return fight.faceDownUids.includes(uid) || fight.hypnotizedUids.includes(uid);
}

/** Cartes du dessus du deck visibles grâce à un talent Vision en main. */
export function scoutedCards(state: RunState, fight: FightState, index: CardIndex): number[] {
  const scouting = fight.hand.some(
    (uid) => cardOf(index, instanceOf(state, uid)).abilityFamily === 'scout',
  );
  return scouting ? fight.drawPile.slice(0, SCOUT_DEPTH) : [];
}

function scoreInput(
  state: RunState,
  fight: FightState,
  index: CardIndex,
  uids: readonly number[],
  estimate: boolean,
): ScoreInput {
  const { opponent } = fight;
  return {
    index,
    played: uids.map((uid) => instanceOf(state, uid)),
    hand: fight.hand.filter((uid) => !uids.includes(uid)).map((uid) => instanceOf(state, uid)),
    opponent,
    tools: state.tools,
    disabledToolUids: disabledToolUids(fight),
    rules: currentRules(fight),
    comboCounts: state.stats.comboCounts,
    seenDexIds: state.stats.seenDexIds,
    money: state.money,
    retreatPoints: fight.retreatPoints,
    fightsWon: state.stats.fightsWon,
    turn: fight.turn,
    maxTurns: fight.maxTurns,
    deckSize: state.deck.length,
    rng: estimate ? null : state.rng,
  };
}

/** Score estimé d'une sélection, sans jet ni changement d'état. */
export function previewHand(
  state: RunState,
  index: CardIndex,
  uids: readonly number[],
): ScoreResult {
  return scoreHand(scoreInput(state, requireFight(state), index, uids, true));
}

/** Vrai si la Brume ou une carte cachée interdit de montrer l'estimation au joueur. */
export function isPreviewMasked(fight: FightState, uids: readonly number[]): boolean {
  return currentRules(fight).hideCombo || uids.some((uid) => isHidden(fight, uid));
}

function validatePlay(state: RunState, fight: FightState, uids: readonly number[]): void {
  if (fight.searchChoices) throw new IllegalActionError('searchPending');
  if (uids.length === 0 || uids.length > maxPlayed(state, fight)) {
    throw new IllegalActionError('invalidCount');
  }
  if (new Set(uids).size !== uids.length) throw new IllegalActionError('duplicateCard');
  for (const uid of uids) {
    if (!fight.hand.includes(uid)) throw new IllegalActionError('notInHand');
    if (fight.paralyzedUids.includes(uid)) throw new IllegalActionError('paralyzed');
  }
  for (const uid of fight.forcedUids) {
    if (!uids.includes(uid)) throw new IllegalActionError('forcedCard');
  }
}

/** La première Base du deck de la lignée de `card` qui peut évoluer. */
function findEvolution(
  state: RunState,
  index: CardIndex,
  card: CardData,
): { uid: number; from: CardData; to: CardData } | null {
  const lineNames = new Set([card.name.en]);
  for (let parent = card.evolveFrom; parent !== null; ) {
    lineNames.add(parent);
    parent = index.byEnglishName.get(parent)?.[0]?.evolveFrom ?? null;
  }
  for (const instance of state.deck) {
    const from = cardOf(index, instance);
    if (from.stage !== 'Basic' || !lineNames.has(from.name.en)) continue;
    // Une Base à plusieurs évolutions, comme Évoli, suit la carte qui déclenche le talent.
    const to = evolvesFrom(card, from)
      ? card
      : index.set.cards.find((other) => evolvesFrom(other, from));
    if (to) return { uid: instance.uid, from, to };
  }
  return null;
}

function applyEffects(
  state: RunState,
  fight: FightState,
  index: CardIndex,
  result: ScoreResult,
  events: Events,
): void {
  const sources = result.scoringUids.map((uid) => cardOf(index, instanceOf(state, uid)));
  for (const effect of result.effects) {
    switch (effect) {
      case 'evolution': {
        if (state.arenaEvolutionUsed) break;
        const source = sources.find((card) => card.abilityFamily === 'evolution');
        const evolution = source && findEvolution(state, index, source);
        if (!evolution) break;
        state.arenaEvolutionUsed = true;
        instanceOf(state, evolution.uid).cardId = evolution.to.id;
        events.push({
          type: 'cardEvolved',
          uid: evolution.uid,
          fromId: evolution.from.id,
          toId: evolution.to.id,
        });
        break;
      }
      case 'recovery': {
        const uid = fight.discardPile.pop();
        if (uid === undefined) break;
        fight.hand.push(uid);
        events.push({ type: 'cardRecovered', uid });
        break;
      }
      case 'affliction':
        fight.afflicted = true;
        break;
      case 'heal':
        if (fight.announcedStatus) {
          events.push({ type: 'statusCancelled', id: fight.announcedStatus });
          fight.announcedStatus = null;
        }
        break;
      case 'energy': {
        const target = pick(state.rng, state.deck);
        const energy = cardOf(index, target).types[0];
        if (!energy) break;
        target.energies.push(energy);
        events.push({ type: 'energyAttached', uid: target.uid, energy });
        break;
      }
      case 'search':
        fight.pendingSearches += 1;
        break;
      case 'draw':
        fight.extraDraw += 1;
        break;
      case 'discard':
        fight.retreatPoints += 1;
        break;
      case 'reward':
        break;
    }
  }
}

function recordHand(
  state: RunState,
  index: CardIndex,
  uids: readonly number[],
  result: ScoreResult,
  disabled: readonly number[],
): void {
  const { stats } = state;
  stats.handsPlayed += 1;
  stats.bestHand = Math.max(stats.bestHand, result.score);
  stats.comboCounts[result.combo] = (stats.comboCounts[result.combo] ?? 0) + 1;
  const seen = new Set(stats.seenDexIds);
  for (const uid of uids) {
    for (const dexId of cardOf(index, instanceOf(state, uid)).dexIds) seen.add(dexId);
  }
  stats.seenDexIds = [...seen];
  for (const tool of state.tools) {
    if (disabled.includes(tool.uid)) continue;
    tool.stacks += TOOLS[tool.toolId].stacksGained?.(result.combo) ?? 0;
  }
}

function fightGains(state: RunState, fight: FightState, rewards: number): FightGains {
  const unused = fight.maxTurns - fight.turn;
  const picnic = state.tools.reduce(
    (sum, tool) => sum + (TOOLS[tool.toolId].moneyPerUnusedTurn ?? 0) * unused,
    0,
  );
  const victory = WIN_MONEY[fight.opponent.kind];
  const unusedTurns = UNUSED_TURN_MONEY * unused;
  const disabled = disabledToolUids(fight);
  const interestCap = INTEREST_CAP + toolBonus(state, disabled, (def) => def.interestCapBonus);
  const interest = Math.min(interestCap, Math.floor(state.money / INTEREST_STEP));
  const reward = REWARD_MONEY * rewards;
  const bonus = toolBonus(state, disabled, (def) => def.moneyPerWin);
  const total = victory + unusedTurns + interest + picnic + reward + bonus;
  return { victory, unusedTurns, interest, picnic, reward, bonus, total };
}

/** Les Outils qui grandissent à chaque victoire. */
function growTools(state: RunState, fight: FightState): void {
  const disabled = disabledToolUids(fight);
  for (const tool of state.tools) {
    if (!disabled.includes(tool.uid)) tool.stacks += TOOLS[tool.toolId].stacksPerWin ?? 0;
  }
}

export type FightOutcome = 'ongoing' | 'won' | 'lost';

export function playCards(
  state: RunState,
  index: CardIndex,
  uids: readonly number[],
  events: Events,
): { outcome: FightOutcome; gains: FightGains | null } {
  const fight = requireFight(state);
  validatePlay(state, fight, uids);
  const result = scoreHand(scoreInput(state, fight, index, uids, false));
  removeFromHand(fight, uids);
  events.push({ type: 'handPlayed', result });

  const { opponent } = fight;
  const dealt = result.score + result.flatDamage;
  opponent.hp = Math.max(0, opponent.hp - dealt);
  events.push({ type: 'opponentDamaged', amount: dealt, hp: opponent.hp });
  recordHand(state, index, uids, result, disabledToolUids(fight));
  applyEffects(state, fight, index, result, events);
  if (result.moneyGained > 0) {
    state.money += result.moneyGained;
    events.push({ type: 'moneyGained', amount: result.moneyGained });
  }

  // Récompense exige que la main batte l'adversaire : pas une fin de Tour par Affliction.
  if (opponent.hp <= 0) {
    const rewards = result.effects.filter((effect) => effect === 'reward').length;
    growTools(state, fight);
    return { outcome: 'won', gains: fightGains(state, fight, rewards) };
  }

  refillHand(state, fight);
  if (fight.afflicted) {
    const amount = Math.floor(opponent.maxHp * AFFLICTION_PERCENT);
    opponent.hp = Math.max(0, opponent.hp - amount);
    events.push({ type: 'afflictionTick', amount });
    if (opponent.hp <= 0) {
      growTools(state, fight);
      return { outcome: 'won', gains: fightGains(state, fight, 0) };
    }
  }
  if (fight.turn >= fight.maxTurns) return { outcome: 'lost', gains: null };
  beginTurn(state, fight, events);
  if (fight.hand.length === 0) return { outcome: 'lost', gains: null };
  return { outcome: 'ongoing', gains: null };
}

export function discardCards(
  state: RunState,
  index: CardIndex,
  uids: readonly number[],
  events: Events,
): void {
  const fight = requireFight(state);
  if (fight.searchChoices) throw new IllegalActionError('searchPending');
  if (uids.length === 0) throw new IllegalActionError('invalidCount');
  if (new Set(uids).size !== uids.length) throw new IllegalActionError('duplicateCard');
  let cost = 0;
  for (const uid of uids) {
    if (!fight.hand.includes(uid)) throw new IllegalActionError('notInHand');
    if (fight.forcedUids.includes(uid)) {
      throw new IllegalActionError('forcedCard');
    }
    cost += retreatCost(state, fight, index, uid);
  }
  if (cost > fight.retreatPoints) throw new IllegalActionError('notEnoughRetreat');

  const moneyPerFree = state.tools
    .filter((tool) => !disabledToolUids(fight).includes(tool.uid))
    .reduce((sum, tool) => sum + (TOOLS[tool.toolId].moneyPerFreeDiscard ?? 0), 0);
  const free = uids.filter((uid) => cardOf(index, instanceOf(state, uid)).retreat === 0).length;
  const money = moneyPerFree * free;
  state.money += money;
  fight.retreatPoints -= cost;
  removeFromHand(fight, uids);
  if (hasPermanent(fight, 'Fire')) state.arenaBanishedUids.push(...uids);
  else fight.discardPile.push(...uids);
  events.push({ type: 'discarded', uids: [...uids], cost, money });
  refillHand(state, fight);
}

export function swapCard(state: RunState, index: CardIndex, uid: number, events: Events): void {
  const fight = requireFight(state);
  if (fight.searchChoices) throw new IllegalActionError('searchPending');
  if (!fight.hand.includes(uid)) throw new IllegalActionError('notInHand');
  if (cardOf(index, instanceOf(state, uid)).abilityFamily !== 'switch') {
    throw new IllegalActionError('noSwitchTalent');
  }
  if (fight.swappedUids.includes(uid)) throw new IllegalActionError('swapUsed');
  if (fight.drawPile.length === 0) throw new IllegalActionError('emptyDeck');
  removeFromHand(fight, [uid]);
  const drawnUid = drawCard(state, fight);
  fight.drawPile.unshift(uid);
  fight.swappedUids.push(uid);
  if (drawnUid !== null) events.push({ type: 'swapped', uid, drawnUid });
}

export function resolveSearch(state: RunState, uid: number, events: Events): void {
  const fight = requireFight(state);
  if (!fight.searchChoices?.includes(uid)) throw new IllegalActionError('invalidSearch');
  fight.drawPile = fight.drawPile.filter((other) => other !== uid);
  fight.hand.push(uid);
  events.push({ type: 'searchResolved', uid });
  openSearch(fight);
}
