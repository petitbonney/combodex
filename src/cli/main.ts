/** `npm run play -- --seed=42 --lang=fr --set=sm1` : jouer une run à la main dans le terminal. */
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { DEFAULT_ARENA_COUNT } from '../content/balance.ts';
import type { Language } from '../content/i18n/index.ts';
import { STARTING_SET } from '../content/sets.ts';
import { loadCards } from '../data.ts';
import {
  type Action,
  applyAction,
  type CardData,
  type CardIndex,
  cardOf,
  createRun,
  evolvesFrom,
  type FightState,
  IllegalActionError,
  previewHand,
  type RunState,
  seedFromText,
} from '../engine/index.ts';
import {
  cardLine,
  createView,
  deckOrder,
  renderBooster,
  renderDeck,
  renderEvent,
  renderFight,
  renderIntro,
  renderPreview,
  renderRunStart,
  renderSearch,
  renderShop,
  type View,
} from './render.ts';

const { values } = parseArgs({
  options: {
    seed: { type: 'string' },
    lang: { type: 'string', default: 'fr' },
    arenas: { type: 'string', default: String(DEFAULT_ARENA_COUNT) },
    set: { type: 'string', default: STARTING_SET },
  },
});

const index: CardIndex = loadCards(values.set);
const view: View = createView(values.lang as Language, index);
const { ui } = view.text;
const seed = values.seed
  ? /^\d+$/.test(values.seed)
    ? Number(values.seed)
    : seedFromText(values.seed)
  : Date.now() % 2147483647;

const terminal = createInterface({ input: process.stdin, output: process.stdout });
const lines = terminal[Symbol.asyncIterator]();

/** Lit une ligne ; `null` en fin d'entrée. */
async function ask(prompt: string): Promise<string | null> {
  process.stdout.write(prompt);
  const { value, done } = await lines.next();
  return done ? null : String(value).trim();
}

function print(text: string[]): void {
  console.log(text.join('\n'));
}

function numbers(words: readonly string[]): number[] | null {
  const parsed = words.map(Number);
  return parsed.every((value) => Number.isInteger(value) && value > 0) ? parsed : null;
}

function handUids(fight: FightState, positions: readonly number[]): number[] | null {
  const uids = positions.map((position) => fight.hand[position - 1]);
  return uids.every((uid) => uid !== undefined) ? (uids as number[]) : null;
}

/** Applique une action et affiche ses événements ; une action illégale ne change rien. */
function perform(state: RunState, action: Action): RunState {
  try {
    const { state: next, events } = applyAction(state, action, index);
    // Le détail d'une main se lit sur l'état d'avant : une évolution ne le réécrit pas.
    print(
      events.flatMap((event) =>
        renderEvent(view, event.type === 'handPlayed' ? state : next, event),
      ),
    );
    return next;
  } catch (error) {
    if (error instanceof IllegalActionError) {
      console.log(view.text.illegal[error.reason]);
      return state;
    }
    throw error;
  }
}

function toolOrder(state: RunState, positions: readonly number[]): number[] | null {
  const uids = positions.map((position) => state.tools[position - 1]?.uid);
  return uids.every((uid) => uid !== undefined) ? (uids as number[]) : null;
}

/** Les cartes du deck désignées par leur position dans `deckOrder`. */
function deckUids(state: RunState, positions: readonly number[]): number[] {
  const deck = deckOrder(view, state);
  return positions.flatMap((position) => deck[position - 1]?.uid ?? []);
}

async function fightTurn(state: RunState, fight: FightState): Promise<RunState | null> {
  if (fight.searchChoices) {
    print(renderSearch(view, state, fight.searchChoices));
    const answer = await ask(ui.searchPrompt);
    if (answer === null) return null;
    const uid = fight.searchChoices[Number(answer) - 1];
    if (uid === undefined) {
      console.log(ui.invalidInput);
      return state;
    }
    return perform(state, { type: 'resolveSearch', uid });
  }
  print(renderFight(view, state, fight));
  const answer = await ask(ui.fightPrompt);
  if (answer === null) return null;
  const [command, ...rest] = answer.split(/\s+/);
  const positions = numbers(rest);
  if (command === 'q') return null;
  if (command === '?') {
    console.log(ui.fightHelp);
    return state;
  }
  if (command === 'k') {
    print(renderDeck(view, state));
    return state;
  }
  if (command === 'u') return perform(state, { type: 'useAce' });
  if (positions === null) {
    console.log(ui.invalidInput);
    return state;
  }
  const uids = handUids(fight, positions);
  if (command === 'o') {
    const order = toolOrder(state, positions);
    if (order) return perform(state, { type: 'reorderTools', uids: order });
  }
  if (uids === null || uids.length === 0) {
    console.log(ui.invalidInput);
    return state;
  }
  switch (command) {
    case 'j':
    case 'p':
      return perform(state, { type: 'play', uids });
    case 'd':
      return perform(state, { type: 'discard', uids });
    case 'a':
      console.log(renderPreview(view, fight, uids, previewHand(state, index, uids)));
      return state;
    case 'e':
    case 's':
      return perform(state, { type: 'swap', uid: uids[0] as number });
    default:
      console.log(ui.invalidInput);
      return state;
  }
}

/** Propose de poser une évolution sur une carte du deck ; renvoie son uid. */
async function evolveChoice(state: RunState, card: CardData): Promise<number | undefined | null> {
  const targets = deckOrder(view, state).filter((entry) => evolvesFrom(card, cardOf(index, entry)));
  if (targets.length === 0) return undefined;
  print(targets.map((entry, position) => cardLine(view, entry, position + 1)));
  const answer = await ask(ui.evolvePrompt(card.name[view.language]));
  if (answer === null) return null;
  return targets[Number(answer) - 1]?.uid;
}

async function shopTurn(state: RunState): Promise<RunState | null> {
  const shop = state.shop;
  if (!shop) return state;
  print(renderShop(view, state, shop));
  const answer = await ask(ui.shopPrompt);
  if (answer === null) return null;
  if (answer === '') return perform(state, { type: 'leaveShop' });
  const [command, ...rest] = answer.split(/\s+/);
  const positions = numbers(rest) ?? [];
  const first = (positions[0] ?? 0) - 1;
  switch (command) {
    case '?':
      console.log(ui.shopHelp);
      return state;
    case 'k':
      print(renderDeck(view, state));
      return state;
    case 'r':
      return perform(state, { type: 'reroll' });
    case 'c': {
      const [targetUid] = deckUids(state, positions);
      return perform(state, {
        type: 'buyConsumable',
        ...(targetUid === undefined ? {} : { targetUid }),
      });
    }
    case 'u':
      return perform(state, { type: 'useAce', targetUids: deckUids(state, positions) });
    case 'n': {
      const [uid] = deckUids(state, positions);
      if (uid !== undefined) return perform(state, { type: 'removeCard', uid });
      break;
    }
    case 'b':
      return perform(state, { type: 'buyBooster', index: first });
    case 'v': {
      const tool = state.tools[first];
      if (tool) return perform(state, { type: 'sellTool', uid: tool.uid });
      break;
    }
    case 'o': {
      const order = toolOrder(state, positions);
      if (order) return perform(state, { type: 'reorderTools', uids: order });
      break;
    }
    case 'a': {
      const slot = shop.slots[first];
      if (!slot) break;
      if (slot.kind === 'tool') return perform(state, { type: 'buySlot', index: first });
      const card = index.byId.get(slot.cardId) as CardData;
      const evolveUid = await evolveChoice(state, card);
      if (evolveUid === null) return null;
      return perform(state, {
        type: 'buySlot',
        index: first,
        ...(evolveUid === undefined ? {} : { evolveUid }),
      });
    }
    default:
      break;
  }
  console.log(ui.invalidInput);
  return state;
}

async function boosterTurn(state: RunState): Promise<RunState | null> {
  const booster = state.booster;
  if (!booster) return state;
  print(renderBooster(view, booster));
  if (booster.kind === 'trainer') {
    const answer = await ask(ui.boosterPrompt);
    if (answer === null) return null;
    if (answer === '') return perform(state, { type: 'skipBooster' });
    return perform(state, { type: 'keepBoosterTool', index: Number(answer) - 1 });
  }
  if (booster.kind === 'energy') {
    print(deckOrder(view, state).map((entry, position) => cardLine(view, entry, position + 1)));
    const answer = await ask(ui.boosterEnergyPrompt);
    if (answer === null) return null;
    if (answer === '') return perform(state, { type: 'skipBooster' });
    const [energy, target] = numbers(answer.split(/\s+/)) ?? [];
    const entry = target === undefined ? undefined : deckOrder(view, state)[target - 1];
    if (energy === undefined || !entry) {
      console.log(ui.invalidInput);
      return state;
    }
    return perform(state, {
      type: 'keepBoosterEnergy',
      index: energy - 1,
      targetUid: entry.uid,
    });
  }
  const answer = await ask(ui.boosterPrompt);
  if (answer === null) return null;
  if (answer === '') return perform(state, { type: 'skipBooster' });
  const position = Number(answer) - 1;
  const entry = booster.cards[position];
  if (!entry) {
    console.log(ui.invalidInput);
    return state;
  }
  const evolveUid = await evolveChoice(state, index.byId.get(entry.cardId) as CardData);
  if (evolveUid === null) return null;
  return perform(state, {
    type: 'keepBoosterCard',
    index: position,
    ...(evolveUid === undefined ? {} : { evolveUid }),
  });
}

async function introTurn(state: RunState): Promise<RunState | null> {
  print(renderIntro(view, state));
  const canSkip = state.stageIndex < 2;
  const answer = await ask(ui.introPrompt(canSkip));
  if (answer === null) return null;
  if (answer === 'p' && canSkip) return perform(state, { type: 'skipFight' });
  return perform(state, { type: 'startFight' });
}

async function main(): Promise<void> {
  let state: RunState | null = createRun(index, { seed, arenaCount: Number(values.arenas) });
  print(renderRunStart(view, state));
  while (state && state.phase !== 'won' && state.phase !== 'lost') {
    switch (state.phase) {
      case 'intro':
        state = await introTurn(state);
        break;
      case 'fight':
        state = state.fight ? await fightTurn(state, state.fight) : null;
        break;
      case 'shop':
        state = await shopTurn(state);
        break;
      case 'booster':
        state = await boosterTurn(state);
        break;
    }
  }
  if (state) {
    console.log(ui.runOver(state.phase === 'won', state.stats.fightsWon, state.stats.bestHand));
  }
  terminal.close();
}

await main();
