/**
 * Transforme les événements du moteur en séquence d'animation. Aucune règle ici : les montants et
 * les totaux viennent du moteur, la timeline ne fait que les mettre en scène.
 */
import type { Language, Messages } from '../../content/i18n/index.ts';
import { STATUSES, type StatusId } from '../../content/statuses.ts';
import {
  type AbilityFamily,
  type Action,
  type CardIndex,
  type ComboId,
  cardOf,
  type FightGains,
  type GameEvent,
  instanceOf,
  type RunState,
  type ScoreResult,
} from '../../engine/index.ts';

export type NoticeTone = 'good' | 'bad' | 'info';

export interface Running {
  damage: number;
  mult: number;
}

export type Beat =
  | { kind: 'reveal'; playedUids: number[] }
  | { kind: 'combo'; combo: ComboId; demotedFrom: ComboId | null; running: Running }
  | {
      kind: 'card';
      uid: number;
      damage: number;
      addMult: number;
      timesMult: number;
      talent: AbilityFamily | null;
      running: Running;
    }
  | { kind: 'silenced'; uid: number; running: Running }
  | {
      kind: 'tool';
      uid: number;
      addMult: number;
      timesMult: number;
      addDamage: number;
      running: Running;
    }
  | { kind: 'modifier'; label: string; running: Running }
  | { kind: 'total'; damage: number; mult: number; score: number; flatDamage: number }
  | { kind: 'hit'; amount: number; hp: number }
  | { kind: 'notice'; text: string; tone: NoticeTone; hp?: number }
  | { kind: 'turn'; turn: number }
  | { kind: 'roll'; id: StatusId; dice: 'coin' | 'die'; success: boolean; rolled: number | null }
  | { kind: 'statusHit'; id: StatusId }
  | { kind: 'announce'; id: StatusId }
  | { kind: 'gains'; gains: FightGains; arenaCleared: number | null }
  | { kind: 'defeat' };

export type BeatKind = Beat['kind'];

/** Durée de chaque temps à la vitesse normale, en millisecondes. */
export const BEAT_MS: Record<Exclude<BeatKind, 'gains'>, number> = {
  reveal: 300,
  combo: 650,
  card: 500,
  silenced: 400,
  tool: 500,
  modifier: 500,
  total: 900,
  hit: 750,
  notice: 1200,
  turn: 700,
  roll: 1700,
  statusHit: 1100,
  announce: 1200,
  defeat: 1100,
};

export interface TimelineInput {
  before: RunState;
  after: RunState;
  action: Action;
  events: readonly GameEvent[];
  index: CardIndex;
  language: Language;
  text: Messages;
}

/** Le premier groupe se joue avant d'afficher le nouvel état, le second après. */
export interface Timeline {
  before: Beat[];
  after: Beat[];
}

function scoreBeats(result: ScoreResult, input: TimelineInput): Beat[] {
  const { ui } = input.text;
  const beats: Beat[] = [{ kind: 'reveal', playedUids: result.playedUids }];
  result.steps.forEach((step, position) => {
    const running = result.running[position] as Running;
    switch (step.kind) {
      case 'combo':
        beats.push({
          kind: 'combo',
          combo: step.combo,
          demotedFrom: result.combo === step.combo ? null : result.combo,
          running,
        });
        break;
      case 'card':
        beats.push({ ...step, running });
        break;
      case 'silenced':
        beats.push({ kind: 'silenced', uid: step.uid, running });
        break;
      case 'tool':
        beats.push({ ...step, running });
        break;
      case 'cardTimes':
        beats.push({ kind: 'modifier', label: ui.stepCardTimes(step.times).trim(), running });
        break;
      case 'multChange':
        beats.push({ kind: 'modifier', label: ui.stepPenalty(step.amount).trim(), running });
        break;
      case 'weakness':
        beats.push({ kind: 'modifier', label: ui.stepWeakness(step.times).trim(), running });
        break;
      case 'damageChange': {
        const labels = {
          furnace: ui.stepFurnace,
          loss: ui.stepLoss,
          counterAttack: ui.stepCounterAttack,
          resistance: ui.stepResistance,
        };
        beats.push({ kind: 'modifier', label: labels[step.source](step.amount).trim(), running });
        break;
      }
    }
  });
  beats.push({
    kind: 'total',
    damage: result.damage,
    mult: result.mult,
    score: result.score,
    flatDamage: result.flatDamage,
  });
  return beats;
}

/** Le détail d'une main se lit sur l'état d'avant : une évolution ne le réécrit pas. */
export function buildTimeline(input: TimelineInput): Timeline {
  const { after, before, events, index, language, text } = input;
  const { ui, statuses, types } = text;
  const name = (uid: number) => cardOf(index, instanceOf(after, uid)).name[language];
  const byId = (id: string) => index.byId.get(id)?.name[language] ?? id;
  const first: Beat[] = [];
  const last: Beat[] = [];
  const announcements: Beat[] = [];
  let hp = (after.fight ?? before.fight)?.opponent.maxHp ?? 0;
  // Sans main jouée, tout se passe sur le nouvel écran, par exemple au début d'un combat.
  const scoring = input.action.type === 'play';
  const main = scoring ? first : last;
  const fightEnd = events.find((event) => event.type === 'fightWon');

  for (const event of events) {
    switch (event.type) {
      case 'handPlayed':
        first.push(...scoreBeats(event.result, input));
        break;
      case 'opponentDamaged':
        hp = event.hp;
        first.push({ kind: 'hit', amount: event.amount, hp });
        break;
      case 'afflictionTick':
        hp = Math.max(0, hp - event.amount);
        main.push({ kind: 'notice', text: ui.eventAffliction(event.amount), tone: 'good', hp });
        break;
      case 'opponentHealed':
        hp += event.amount;
        main.push({ kind: 'notice', text: ui.eventHealed(event.amount), tone: 'bad', hp });
        break;
      case 'turnStarted':
        if (event.turn > 1) main.push({ kind: 'turn', turn: event.turn });
        break;
      case 'statusAnnounced':
        announcements.push({ kind: 'announce', id: event.id });
        break;
      case 'statusCancelled':
        main.push({
          kind: 'notice',
          text: ui.eventCancelled(statuses[event.id].name),
          tone: 'good',
        });
        break;
      case 'statusRolled': {
        const { roll } = STATUSES[event.id];
        if (roll === 'none') main.push({ kind: 'statusHit', id: event.id });
        else {
          main.push({
            kind: 'roll',
            id: event.id,
            dice: roll === 'coin' ? 'coin' : 'die',
            success: event.success,
            rolled: event.rolled,
          });
        }
        break;
      }
      case 'statusCopied':
        main.push({ kind: 'notice', text: ui.eventCopied(statuses[event.id].name), tone: 'bad' });
        break;
      case 'moneyLost':
        last.push({ kind: 'notice', text: ui.eventMoneyLost(event.amount), tone: 'bad' });
        break;
      case 'moneyGained':
        last.push({ kind: 'notice', text: ui.eventMoney(event.amount), tone: 'good' });
        break;
      case 'weaknessChanged':
        if (before.fight) {
          last.push({
            kind: 'notice',
            text: ui.eventWeakness(types[event.weakness]),
            tone: 'info',
          });
        }
        break;
      case 'aceUsed':
        last.push({ kind: 'notice', text: ui.eventAce(text.aces[event.id].name), tone: 'good' });
        break;
      case 'retreatLost':
        last.push({ kind: 'notice', text: ui.eventRetreatLost(event.amount), tone: 'bad' });
        break;
      case 'handBurned':
        last.push({
          kind: 'notice',
          text: ui.eventBurned(name(event.uid), event.banished),
          tone: 'bad',
        });
        break;
      case 'handReturned':
        last.push({ kind: 'notice', text: ui.eventReturned(event.uids.length), tone: 'bad' });
        break;
      case 'discarded':
        if (event.money > 0) {
          last.push({
            kind: 'notice',
            text: ui.eventDiscarded(event.uids.length, event.cost, event.money),
            tone: 'good',
          });
        }
        break;
      case 'cardRecovered':
        last.push({ kind: 'notice', text: ui.eventRecovered(name(event.uid)), tone: 'good' });
        break;
      case 'cardEvolved':
        main.push({
          kind: 'notice',
          text: ui.eventEvolved(byId(event.fromId), byId(event.toId)),
          tone: 'good',
        });
        break;
      case 'energyAttached':
        main.push({
          kind: 'notice',
          text: ui.eventEnergy(name(event.uid), types[event.energy]),
          tone: 'good',
        });
        break;
      case 'swapped':
        last.push({
          kind: 'notice',
          text: ui.eventSwapped(name(event.uid), name(event.drawnUid)),
          tone: 'info',
        });
        break;
      case 'searchResolved':
        last.push({ kind: 'notice', text: ui.eventSearched(name(event.uid)), tone: 'good' });
        break;
      case 'fightSkipped':
        last.push({ kind: 'notice', text: ui.eventSkipped, tone: 'info' });
        break;
      case 'fightLost':
        first.push({ kind: 'defeat' });
        break;
      case 'fightStarted':
      case 'fightWon':
      case 'arenaCleared':
      case 'runWon':
        break;
    }
  }
  if (fightEnd?.type === 'fightWon') {
    const kind = before.fight?.opponent.kind;
    const champion = kind === 'champion';
    const arenaCleared = champion ? before.arenaIndex + 1 : null;
    first.push({ kind: 'gains', gains: fightEnd.gains, arenaCleared });
  }
  last.push(...announcements);
  return { before: first, after: last };
}
