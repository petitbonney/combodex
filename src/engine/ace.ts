/** ACE SPEC : consommables gardés en réserve, utilisés au moment choisi par le joueur. */
import {
  CLEANUP_CARDS,
  JACKPOT_CAP,
  MAX_TAG_TEAMS,
  MIN_DECK_SIZE,
  SECOND_WIND_RETREAT,
  SECOND_WIND_TURNS,
} from '../content/balance.ts';
import { ACE_SPECS, type AceSpecDef, type AceSpecId } from '../content/consumables.ts';
import { type CardIndex, cardOf } from './cards.ts';
import { pick } from './rng.ts';
import { tagTeamCount } from './shop.ts';
import { type GameEvent, IllegalActionError, instanceOf, type RunState } from './state.ts';

function checkTiming(state: RunState, def: AceSpecDef): void {
  const inFight = state.phase === 'fight';
  const outside = state.phase === 'shop' || state.phase === 'intro';
  const allowed = {
    fight: inFight,
    outsideFight: outside,
    anytime: inFight || outside,
  }[def.timing];
  if (!allowed) throw new IllegalActionError('aceNotNow');
  if (state.fight?.searchChoices) throw new IllegalActionError('searchPending');
}

function checkTargets(state: RunState, def: AceSpecDef, targets: readonly number[]): void {
  if (targets.length !== def.targets) throw new IllegalActionError('invalidTarget');
  if (new Set(targets).size !== targets.length) throw new IllegalActionError('duplicateCard');
  for (const uid of targets) instanceOf(state, uid);
}

function handInstances(state: RunState) {
  return (state.fight?.hand ?? []).map((uid) => instanceOf(state, uid));
}

function duplicate(state: RunState, index: CardIndex, uid: number): void {
  const original = instanceOf(state, uid);
  if (cardOf(index, original).isTagTeam && tagTeamCount(state, index) >= MAX_TAG_TEAMS) {
    throw new IllegalActionError('tooManyTagTeams');
  }
  state.deck.push({ ...structuredClone(original), uid: state.nextUid++ });
}

function cleanUp(state: RunState, targets: readonly number[]): void {
  if (state.deck.length - CLEANUP_CARDS < MIN_DECK_SIZE) {
    throw new IllegalActionError('deckTooSmall');
  }
  state.deck = state.deck.filter((card) => !targets.includes(card.uid));
  state.arenaBanishedUids = state.arenaBanishedUids.filter((uid) => !targets.includes(uid));
  state.toolSlots += 1;
}

/** Une carte de haute rareté de l'extension, en holo ; jamais une TAG TEAM de trop. */
function pullLegendary(state: RunState, index: CardIndex): void {
  const tagTeamsFull = tagTeamCount(state, index) >= MAX_TAG_TEAMS;
  const pool = index.set.cards.filter(
    (card) =>
      (card.rarity === 'Ultra Rare' || card.rarity === 'Secret Rare') &&
      !(card.isTagTeam && tagTeamsFull),
  );
  const card = pick(state.rng, pool);
  state.deck.push({ uid: state.nextUid++, cardId: card.id, variant: 'holo', energies: [] });
}

function applyAce(
  state: RunState,
  index: CardIndex,
  id: AceSpecId,
  targets: readonly number[],
): void {
  const [target] = targets;
  switch (id) {
    case 'goldenHand':
      for (const card of handInstances(state)) card.variant = 'holo';
      break;
    case 'energyRain':
      for (const card of handInstances(state)) {
        const type = cardOf(index, card).types[0];
        if (type) card.energies.push(type);
      }
      break;
    case 'secondWind': {
      const { fight } = state;
      if (!fight) throw new IllegalActionError('noFight');
      fight.maxTurns += SECOND_WIND_TURNS;
      fight.retreatPoints += SECOND_WIND_RETREAT;
      break;
    }
    case 'duplicator':
      duplicate(state, index, target as number);
      break;
    case 'bigCleanup':
      cleanUp(state, targets);
      break;
    case 'printingPress':
      instanceOf(state, target as number).variant = 'firstEdition';
      break;
    case 'jackpot':
      state.money += Math.min(state.money, JACKPOT_CAP);
      break;
    case 'legendaryPull':
      pullLegendary(state, index);
      break;
  }
}

export function useAce(
  state: RunState,
  index: CardIndex,
  targets: readonly number[],
  events: GameEvent[],
): void {
  const id = state.aceSpec;
  if (!id) throw new IllegalActionError('noAce');
  const def = ACE_SPECS[id];
  checkTiming(state, def);
  checkTargets(state, def, targets);
  applyAce(state, index, id, targets);
  state.aceSpec = null;
  events.push({ type: 'aceUsed', id });
}
