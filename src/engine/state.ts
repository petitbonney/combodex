/** État d'une run, actions du joueur et événements émis par le moteur. */
import type { AceSpecId, SpecialEnergyId } from '../content/consumables.ts';
import type { StatusId } from '../content/statuses.ts';
import type { ToolId, ToolInstance } from '../content/tools.ts';
import type { CardInstance, PokemonType, Variant } from './cards.ts';
import type { Rng } from './rng.ts';
import type { ScoreResult } from './scoring.ts';

export type OpponentKind = 'trainer' | 'elite' | 'champion' | 'league';
export type BossForm = 'permanent' | 'statuses';

export interface Arena {
  type: PokemonType;
  form: BossForm;
  championCardId: string;
  /** Dernière étape de la run : le Maître de la Ligue, en un seul combat. */
  league?: boolean;
}

export interface Opponent {
  kind: OpponentKind;
  cardId: string;
  type: PokemonType;
  maxHp: number;
  hp: number;
  weaknesses: PokemonType[];
  resistances: PokemonType[];
  /** Forme d'effet active ; `null` pour les Dresseurs. */
  form: BossForm | null;
  /** Maître de la Ligue : effet permanent emprunté à une Arène, en plus de ses statuts. */
  leagueEffect?: PokemonType;
}

export interface ActiveStatus {
  id: StatusId;
  /** Vrai pour la version renforcée. */
  strong: boolean;
  /** Statut annoncé quand il s'agit d'une Copie. */
  sourceId: StatusId;
}

/** Les piles contiennent les `uid` des cartes du deck. */
export interface FightState {
  opponent: Opponent;
  drawPile: number[];
  hand: number[];
  discardPile: number[];
  turn: number;
  maxTurns: number;
  retreatPoints: number;
  /** Statut annoncé pour le Tour suivant. */
  announcedStatus: StatusId | null;
  /** Statut qui s'applique à ce Tour, si son jet a réussi. */
  activeStatus: ActiveStatus | null;
  /** Perte de Dégâts du Poison, cumulée d'un Tour à l'autre. */
  poisonPercent: number;
  /** Affliction : le Champion perd des PV à chaque fin de Tour. */
  afflicted: boolean;
  /** Cartes piochées en plus au prochain Tour. */
  extraDraw: number;
  /** Recherches à résoudre au prochain Tour. */
  pendingSearches: number;
  /** Cartes proposées par la Recherche en cours. */
  searchChoices: number[] | null;
  /** Cartes qui ont déjà utilisé leur Échange pendant ce combat. */
  swappedUids: number[];
  /** Cartes tirées face cachée (effet permanent Psy). */
  faceDownUids: number[];
  /** Effets de statut limités au Tour en cours. */
  hypnotizedUids: number[];
  paralyzedUids: number[];
  forcedUids: number[];
  turnDisabledToolUids: number[];
  /** Outil désactivé pendant tout le combat (effet permanent Obscurité). */
  fightDisabledToolUids: number[];
  /** Cartes en plus dans la main, données par les Outils au début du combat. */
  handBonus: number;
}

export interface ShopCardSlot {
  kind: 'card';
  cardId: string;
  variant: Variant;
  price: number;
}

export interface ShopToolSlot {
  kind: 'tool';
  toolId: ToolId;
  type: PokemonType | null;
  price: number;
}

export type ShopSlot = ShopCardSlot | ShopToolSlot;
export type BoosterKind = 'set' | 'energy' | 'trainer' | 'premium';

export interface ShopBooster {
  kind: BoosterKind;
  price: number;
}

/** Le dernier emplacement de la boutique. */
export type ShopConsumable =
  | { kind: 'energy'; energy: PokemonType; price: number }
  | { kind: 'special'; special: SpecialEnergyId; price: number }
  | { kind: 'leap'; price: number }
  | { kind: 'ace'; ace: AceSpecId; price: number };

export interface ShopState {
  slots: (ShopSlot | null)[];
  boosters: (ShopBooster | null)[];
  consumable: ShopConsumable | null;
  rerollCost: number;
}

export interface OpenBooster {
  kind: BoosterKind;
  cards: { cardId: string; variant: Variant }[];
  energies: PokemonType[];
  /** Outils du booster Dresseur, avec leur prix de référence pour la revente. */
  tools: { toolId: ToolId; type: PokemonType | null; price: number }[];
  /** Choix qu'il reste à faire avant que le booster se referme. */
  keeps: number;
  /** Ouvert gratuitement après avoir passé un combat. */
  free: boolean;
}

export type RunPhase = 'intro' | 'fight' | 'shop' | 'booster' | 'won' | 'lost';

export interface RunStats {
  /** Nombre de mains jouées par combinaison. */
  comboCounts: Partial<Record<string, number>>;
  /** Pokémon différents joués pendant la run. */
  seenDexIds: number[];
  bestHand: number;
  handsPlayed: number;
  fightsWon: number;
  /** Champions et Maître de la Ligue vaincus. */
  championsBeaten: number;
}

export interface RunState {
  /** Extension de la run. */
  setId: string;
  seed: number;
  /** Outils que cette run ne propose pas : ceux que le joueur n'a pas encore débloqués. */
  lockedTools: ToolId[];
  /** Lignées choisies pour le deck de départ, par position dans `completeLines`. */
  starterLines: number[] | null;
  /** Date du défi du jour, si la run en est un. */
  dailyDate: string | null;
  rng: Rng;
  phase: RunPhase;
  arenas: Arena[];
  arenaIndex: number;
  /** 0 : Dresseur, 1 : Dresseur d'élite, 2 : Champion. */
  stageIndex: number;
  deck: CardInstance[];
  tools: ToolInstance[];
  /** Emplacements d'Outils. */
  toolSlots: number;
  /** ACE SPEC en réserve : un seul à la fois. */
  aceSpec: AceSpecId | null;
  money: number;
  stats: RunStats;
  /** Cartes retirées du deck jusqu'à la fin de l'Arène. */
  arenaBanishedUids: number[];
  /** Le talent Évolution a servi dans cette Arène. */
  arenaEvolutionUsed: boolean;
  /** Le Centre Pokémon a servi dans cette Arène. */
  arenaCenterUsed: boolean;
  nextUid: number;
  fight: FightState | null;
  shop: ShopState | null;
  booster: OpenBooster | null;
}

export type Action =
  | { type: 'startFight' }
  | { type: 'skipFight' }
  | { type: 'play'; uids: number[] }
  | { type: 'discard'; uids: number[] }
  | { type: 'swap'; uid: number }
  | { type: 'resolveSearch'; uid: number }
  | { type: 'reorderTools'; uids: number[] }
  | { type: 'buySlot'; index: number; evolveUid?: number }
  | { type: 'buyBooster'; index: number }
  | { type: 'buyConsumable'; targetUid?: number }
  | { type: 'useAce'; targetUids?: number[] }
  | { type: 'removeCard'; uid: number }
  | { type: 'sellTool'; uid: number }
  | { type: 'reroll' }
  | { type: 'leaveShop' }
  | { type: 'keepBoosterCard'; index: number; evolveUid?: number }
  | { type: 'keepBoosterEnergy'; index: number; targetUid: number }
  | { type: 'keepBoosterTool'; index: number }
  | { type: 'skipBooster' };

export type GameEvent =
  | { type: 'fightStarted'; opponent: Opponent }
  | { type: 'turnStarted'; turn: number }
  | { type: 'statusAnnounced'; id: StatusId }
  | { type: 'statusCancelled'; id: StatusId }
  | { type: 'statusRolled'; id: StatusId; success: boolean; rolled: number | null }
  | { type: 'statusCopied'; id: StatusId }
  | { type: 'opponentHealed'; amount: number }
  | { type: 'moneyLost'; amount: number }
  | { type: 'retreatLost'; amount: number }
  | { type: 'handBurned'; uid: number; banished: boolean }
  | { type: 'handReturned'; uids: number[] }
  | { type: 'handPlayed'; result: ScoreResult }
  | { type: 'opponentDamaged'; amount: number; hp: number }
  | { type: 'weaknessChanged'; weakness: PokemonType }
  | { type: 'moneyGained'; amount: number }
  | { type: 'aceUsed'; id: AceSpecId }
  | { type: 'afflictionTick'; amount: number }
  | { type: 'discarded'; uids: number[]; cost: number; money: number }
  | { type: 'cardRecovered'; uid: number }
  | { type: 'cardEvolved'; uid: number; fromId: string; toId: string }
  | { type: 'energyAttached'; uid: number; energy: PokemonType }
  | { type: 'swapped'; uid: number; drawnUid: number }
  | { type: 'searchResolved'; uid: number }
  | { type: 'fightWon'; gains: FightGains }
  | { type: 'fightLost' }
  | { type: 'fightSkipped' }
  | { type: 'arenaCleared'; arenaIndex: number }
  | { type: 'runWon' };

export interface FightGains {
  victory: number;
  unusedTurns: number;
  interest: number;
  picnic: number;
  reward: number;
  /** ₽ donnés par les Outils à chaque victoire. */
  bonus: number;
  total: number;
}

export interface ActionResult {
  state: RunState;
  events: GameEvent[];
}

/** Raison d'un refus ; son texte est dans les fichiers de traduction. */
export type IllegalReason =
  | 'aceNotNow'
  | 'aceReserveFull'
  | 'boosterSold'
  | 'centerUsed'
  | 'championCannotBeSkipped'
  | 'deckTooSmall'
  | 'duplicateCard'
  | 'emptyDeck'
  | 'emptySlot'
  | 'forcedCard'
  | 'invalidBoosterChoice'
  | 'invalidCount'
  | 'invalidEvolution'
  | 'invalidSearch'
  | 'invalidTarget'
  | 'invalidToolOrder'
  | 'noAce'
  | 'noBooster'
  | 'noFight'
  | 'noFightToStart'
  | 'noShop'
  | 'noSwitchTalent'
  | 'notEnoughMoney'
  | 'notEnoughRetreat'
  | 'notInHand'
  | 'paralyzed'
  | 'runOver'
  | 'searchPending'
  | 'swapUsed'
  | 'tooManyTagTeams'
  | 'toolSlotsFull'
  | 'unknownCard'
  | 'unknownTool';

export class IllegalActionError extends Error {
  override name = 'IllegalActionError';
  readonly reason: IllegalReason;

  constructor(reason: IllegalReason) {
    super(reason);
    this.reason = reason;
  }
}

export function instanceOf(state: RunState, uid: number): CardInstance {
  const instance = state.deck.find((card) => card.uid === uid);
  if (!instance) throw new IllegalActionError('unknownCard');
  return instance;
}
