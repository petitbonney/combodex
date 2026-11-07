/** Une run : Arènes, enchaînement des combats, et point d'entrée unique du moteur. */
import {
  ARENA_HP,
  CHAMPION_POOL_SIZE,
  DEFAULT_ARENA_COUNT,
  ELITE_HP_RATIO,
  TRAINER_HP_RATIO,
} from '../content/balance.ts';
import type { CardData, CardIndex, PokemonType } from './cards.ts';
import {
  discardCards,
  playCards,
  requireFight,
  resolveSearch,
  startFight,
  swapCard,
} from './fight.ts';
import { coinFlip, createRng, pick, type Rng, sample } from './rng.ts';
import {
  buyBooster,
  buySlot,
  keepBoosterCard,
  keepBoosterEnergy,
  keepBoosterTool,
  openFreeBooster,
  openShop,
  requireBooster,
  requireShop,
  reroll,
  sellTool,
} from './shop.ts';
import { generateStarterDeck } from './starter-deck.ts';
import {
  type Action,
  type ActionResult,
  type Arena,
  type GameEvent,
  IllegalActionError,
  type Opponent,
  type OpponentKind,
  type RunState,
} from './state.ts';

const STAGE_KINDS: readonly OpponentKind[] = ['trainer', 'elite', 'champion'];
const CHAMPION_STAGE = 2;

export interface RunOptions {
  seed: number;
  arenaCount?: number;
}

function cardsOfType(index: CardIndex, type: PokemonType): CardData[] {
  return index.set.cards.filter((card) => card.types[0] === type);
}

function drawChampion(rng: Rng, index: CardIndex, type: PokemonType): CardData {
  const pool = cardsOfType(index, type).sort((a, b) => b.hp - a.hp);
  return pick(rng, pool.slice(0, CHAMPION_POOL_SIZE));
}

/** Tire les Arènes parmi les types présents ; un type qui revient change de forme d'effet. */
function drawArenas(rng: Rng, index: CardIndex, count: number): Arena[] {
  const present = [...new Set(index.set.cards.flatMap((card) => card.types))];
  const arenas: Arena[] = [];
  while (arenas.length < count) {
    for (const type of sample(rng, present, Math.min(present.length, count - arenas.length))) {
      const earlier = arenas.find((arena) => arena.type === type);
      const drawn = coinFlip(rng) ? 'permanent' : 'statuses';
      const form = earlier ? (earlier.form === 'permanent' ? 'statuses' : 'permanent') : drawn;
      arenas.push({ type, form, championCardId: drawChampion(rng, index, type).id });
    }
  }
  return arenas;
}

export function createRun(index: CardIndex, options: RunOptions): RunState {
  const { seed, arenaCount = DEFAULT_ARENA_COUNT } = options;
  const rng = createRng(seed);
  const arenas = drawArenas(rng, index, arenaCount);
  const starter = generateStarterDeck(rng, index);
  const deck = starter.map((card, uid) => ({ uid, ...card, energies: [] }));
  return {
    seed,
    rng,
    phase: 'intro',
    arenas,
    arenaIndex: 0,
    stageIndex: 0,
    deck,
    tools: [],
    money: 0,
    stats: { comboCounts: {}, seenDexIds: [], bestHand: 0, handsPlayed: 0, fightsWon: 0 },
    arenaBanishedUids: [],
    arenaEvolutionUsed: false,
    nextUid: deck.length,
    fight: null,
    shop: null,
    booster: null,
  };
}

export function currentArena(state: RunState): Arena {
  const arena = state.arenas[state.arenaIndex];
  if (!arena) throw new Error(`Arène inconnue : ${state.arenaIndex}`);
  return arena;
}

function championHp(arenaIndex: number): number {
  const hp = ARENA_HP[arenaIndex];
  if (hp === undefined) throw new Error(`Pas de PV pour l'Arène ${arenaIndex}`);
  return hp;
}

function buildOpponent(state: RunState, index: CardIndex): Opponent {
  const arena = currentArena(state);
  const kind = STAGE_KINDS[state.stageIndex] as OpponentKind;
  const card =
    kind === 'champion'
      ? index.byId.get(arena.championCardId)
      : pick(state.rng, cardsOfType(index, arena.type));
  if (!card) throw new Error(`Carte de Champion inconnue : ${arena.championCardId}`);
  const ratio = { trainer: TRAINER_HP_RATIO, elite: ELITE_HP_RATIO, champion: 1 }[kind];
  const maxHp = Math.floor(championHp(state.arenaIndex) * ratio);
  return {
    kind,
    cardId: card.id,
    type: arena.type,
    maxHp,
    hp: maxHp,
    weaknesses: [...card.weaknesses],
    resistances: [...card.resistances],
    form: kind === 'champion' ? arena.form : null,
  };
}

function advance(state: RunState, events: GameEvent[]): void {
  state.fight = null;
  state.shop = null;
  state.booster = null;
  state.phase = 'intro';
  state.stageIndex += 1;
  if (state.stageIndex <= CHAMPION_STAGE) return;
  events.push({ type: 'arenaCleared', arenaIndex: state.arenaIndex });
  state.stageIndex = 0;
  state.arenaIndex += 1;
  state.arenaBanishedUids = [];
  state.arenaEvolutionUsed = false;
}

function play(state: RunState, index: CardIndex, uids: number[], events: GameEvent[]): void {
  const { outcome, gains } = playCards(state, index, uids, events);
  if (outcome === 'lost') {
    state.phase = 'lost';
    events.push({ type: 'fightLost' });
    return;
  }
  if (outcome !== 'won' || !gains) return;
  state.money += gains.total;
  state.stats.fightsWon += 1;
  events.push({ type: 'fightWon', gains });
  const lastArena = state.arenaIndex === state.arenas.length - 1;
  if (lastArena && state.stageIndex === CHAMPION_STAGE) {
    state.fight = null;
    state.phase = 'won';
    events.push({ type: 'arenaCleared', arenaIndex: state.arenaIndex });
    events.push({ type: 'runWon' });
    return;
  }
  state.fight = null;
  openShop(state, index);
}

function requireIntro(state: RunState): void {
  if (state.phase !== 'intro') throw new IllegalActionError('noFightToStart');
}

function closeBooster(state: RunState, events: GameEvent[]): void {
  const { free } = requireBooster(state);
  state.booster = null;
  if (free) advance(state, events);
  else state.phase = 'shop';
}

/** Un choix de fait ; le booster se referme quand il n'en reste plus. */
function afterKeep(state: RunState, events: GameEvent[]): void {
  const booster = requireBooster(state);
  booster.keeps -= 1;
  if (booster.keeps <= 0 || booster.cards.length === 0) closeBooster(state, events);
}

function reorderTools(state: RunState, uids: readonly number[]): void {
  if (state.phase === 'won' || state.phase === 'lost') {
    throw new IllegalActionError('runOver');
  }
  const sameTools =
    uids.length === state.tools.length &&
    new Set(uids).size === uids.length &&
    state.tools.every((tool) => uids.includes(tool.uid));
  if (!sameTools) throw new IllegalActionError('invalidToolOrder');
  state.tools = uids.flatMap((uid) => state.tools.filter((tool) => tool.uid === uid));
}

/** État + action → nouvel état + événements. L'état reçu n'est jamais modifié. */
export function applyAction(state: RunState, action: Action, index: CardIndex): ActionResult {
  const next = structuredClone(state);
  const events: GameEvent[] = [];
  switch (action.type) {
    case 'startFight':
      requireIntro(next);
      startFight(next, buildOpponent(next, index), events);
      break;
    case 'skipFight':
      requireIntro(next);
      if (next.stageIndex === CHAMPION_STAGE) {
        throw new IllegalActionError('championCannotBeSkipped');
      }
      events.push({ type: 'fightSkipped' });
      openFreeBooster(next, index);
      break;
    case 'play':
      requireFight(next);
      play(next, index, action.uids, events);
      break;
    case 'discard':
      discardCards(next, index, action.uids, events);
      break;
    case 'swap':
      swapCard(next, index, action.uid, events);
      break;
    case 'resolveSearch':
      resolveSearch(next, action.uid, events);
      break;
    case 'reorderTools':
      reorderTools(next, action.uids);
      break;
    case 'buySlot':
      buySlot(next, index, action.index, action.evolveUid);
      break;
    case 'buyBooster':
      buyBooster(next, index, action.index);
      break;
    case 'sellTool':
      sellTool(next, action.uid);
      break;
    case 'reroll':
      reroll(next, index);
      break;
    case 'leaveShop':
      requireShop(next);
      advance(next, events);
      break;
    case 'keepBoosterCard':
      keepBoosterCard(next, index, action.index, action.evolveUid);
      afterKeep(next, events);
      break;
    case 'keepBoosterEnergy':
      keepBoosterEnergy(next, action.index, action.targetUid);
      closeBooster(next, events);
      break;
    case 'keepBoosterTool':
      keepBoosterTool(next, action.index);
      closeBooster(next, events);
      break;
    case 'skipBooster':
      closeBooster(next, events);
      break;
  }
  return { state: next, events };
}
