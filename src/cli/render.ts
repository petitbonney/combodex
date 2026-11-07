/** Rendu en texte : fonctions pures de l'état vers des lignes à afficher. */
import type { Language, Messages } from '../content/i18n/index.ts';
import { messagesFor } from '../content/i18n/index.ts';
import { STATUSES, type StatusId } from '../content/statuses.ts';
import { TOOLS, type ToolInstance } from '../content/tools.ts';
import {
  type CardData,
  type CardIndex,
  type CardInstance,
  cardOf,
  currentArena,
  currentRules,
  type FightState,
  type GameEvent,
  instanceOf,
  isHidden,
  isStrong,
  type OpenBooster,
  type RunState,
  type ScoreResult,
  type ScoreStep,
  type ShopState,
  scoutedCards,
} from '../engine/index.ts';

export interface View {
  language: Language;
  text: Messages;
  index: CardIndex;
}

export function createView(language: Language, index: CardIndex): View {
  return { language, text: messagesFor(language), index };
}

const SIGN = (value: number) => (value >= 0 ? `+${value}` : `${value}`);

function cardName(view: View, card: CardData): string {
  return card.name[view.language];
}

function nameOf(view: View, state: RunState, uid: number): string {
  return cardName(view, cardOf(view.index, instanceOf(state, uid)));
}

function typeList(view: View, types: readonly CardData['types'][number][]): string {
  return types.map((type) => view.text.types[type]).join('/') || view.text.ui.none;
}

function toolName(
  view: View,
  tool: { toolId: ToolInstance['toolId']; type: ToolInstance['type'] },
) {
  const { name } = view.text.tools[tool.toolId];
  return tool.type ? `${name} ${view.text.types[tool.type]}` : name;
}

function statusEffect(view: View, id: StatusId, strong: boolean): string {
  const status = view.text.statuses[id];
  return strong ? status.strong : status.base;
}

/** Une carte numérotée sur une ligne ; `position` est son numéro à l'écran. */
export function cardLine(
  view: View,
  instance: CardInstance,
  position: number,
  fight: FightState | null = null,
  hideDamage = false,
): string {
  return `  ${position}. ${cardText(view, instance, fight, hideDamage)}`;
}

function cardText(
  view: View,
  instance: CardInstance,
  fight: FightState | null = null,
  hideDamage = false,
): string {
  const { text } = view;
  const card = cardOf(view.index, instance);
  const flags = [
    card.isTagTeam ? text.ui.tagTeam : '',
    fight?.paralyzedUids.includes(instance.uid) ? text.ui.paralyzed : '',
    fight?.forcedUids.includes(instance.uid) ? text.ui.forced : '',
  ].join('');
  const family = card.abilityFamily && text.families[card.abilityFamily];
  const talent = family ? ` · ${text.ui.labeled(family.name, family.effect)}` : '';
  const energies = instance.energies.length ? ` · +${typeList(view, instance.energies)}` : '';
  const variant = instance.variant === 'normal' ? '' : ` · ${text.variants[instance.variant]}`;
  return text.ui.cardLine({
    name: cardName(view, card),
    types: typeList(view, card.types),
    stage: text.stages[card.stage],
    damage: hideDamage ? '' : text.ui.damageLabel(card.bestDamage),
    hp: card.hp,
    retreat: card.retreat,
    variant,
    energies,
    talent,
    flags,
  });
}

export function renderRunStart(view: View, state: RunState): string[] {
  const { ui, types } = view.text;
  const lines = [ui.title, ui.seed(state.seed), '', ui.arenaPlan];
  state.arenas.forEach((arena, position) => {
    const champion = view.index.byId.get(arena.championCardId);
    const effect = arena.form === 'permanent' ? view.text.permanents[arena.type] : ui.statusForm;
    lines.push(
      ui.arenaLine(
        position + 1,
        types[arena.type],
        champion ? cardName(view, champion) : '?',
        effect,
      ),
    );
  });
  lines.push('', ...renderDeck(view, state));
  return lines;
}

export function renderDeck(view: View, state: RunState): string[] {
  return [
    view.text.ui.deckHeader(state.deck.length),
    ...deckOrder(view, state).map((entry, position) => cardLine(view, entry, position + 1)),
  ];
}

export function deckOrder(view: View, state: RunState): CardInstance[] {
  return [...state.deck].sort((a, b) =>
    cardOf(view.index, a).name[view.language].localeCompare(
      cardOf(view.index, b).name[view.language],
    ),
  );
}

export function renderIntro(view: View, state: RunState): string[] {
  const { ui, opponents, types } = view.text;
  const arena = currentArena(state);
  const kind = (['trainer', 'elite', 'champion'] as const)[state.stageIndex] ?? 'trainer';
  const effect = arena.form === 'permanent' ? view.text.permanents[arena.type] : ui.statusForm;
  const lines = [
    '',
    ui.arenaHeader(state.arenaIndex + 1, state.arenas.length, types[arena.type], opponents[kind]),
  ];
  if (kind === 'champion') lines.push(ui.bossEffect(effect));
  return lines;
}

function renderStatus(view: View, state: RunState, fight: FightState): string[] {
  const { ui, statuses } = view.text;
  const lines: string[] = [];
  const active = fight.activeStatus;
  if (active) {
    lines.push(
      ui.activeStatus(statuses[active.id].name, statusEffect(view, active.id, active.strong)),
    );
  } else if (fight.opponent.form === 'statuses') {
    lines.push(ui.noStatus);
  }
  if (fight.announcedStatus) {
    const id = fight.announcedStatus;
    lines.push(ui.announcedStatus(statuses[id].name, statusEffect(view, id, isStrong(state))));
  }
  if (fight.poisonPercent > 0) lines.push(ui.poison(Math.round(fight.poisonPercent * 100)));
  return lines;
}

function renderTools(view: View, state: RunState, fight: FightState | null): string[] {
  const { ui } = view.text;
  if (state.tools.length === 0) return [ui.noTools];
  const disabled = fight ? [...fight.fightDisabledToolUids, ...fight.turnDisabledToolUids] : [];
  return [
    ui.tools,
    ...state.tools.map((tool, position) => {
      const off = disabled.includes(tool.uid) ? ` (${ui.disabled})` : '';
      const { effect } = view.text.tools[tool.toolId];
      return `  ${position + 1}. ${ui.labeled(`${toolName(view, tool)}${off}`, effect)}`;
    }),
  ];
}

export function renderFight(view: View, state: RunState, fight: FightState): string[] {
  const { ui } = view.text;
  const { opponent } = fight;
  const opponentCard = view.index.byId.get(opponent.cardId);
  const lines = [
    '',
    ui.opponentLine(opponentCard ? cardName(view, opponentCard) : '?', opponent.hp, opponent.maxHp),
    `${ui.labeled(ui.weakness, typeList(view, opponent.weaknesses))} · ${ui.labeled(ui.resistance, typeList(view, opponent.resistances))}`,
  ];
  if (opponent.form === 'permanent') lines.push(ui.bossEffect(view.text.permanents[opponent.type]));
  lines.push(
    ui.turnLine(
      fight.turn,
      fight.maxTurns,
      fight.retreatPoints,
      state.money,
      fight.drawPile.length,
    ),
    ...renderStatus(view, state, fight),
    ...renderTools(view, state, fight),
    ui.hand,
  );
  const masked = currentRules(fight).hideCardDamage;
  fight.hand.forEach((uid, position) => {
    if (isHidden(fight, uid)) {
      lines.push(ui.hiddenCard(position + 1));
      return;
    }
    lines.push(cardLine(view, instanceOf(state, uid), position + 1, fight, masked));
  });
  const scouted = scoutedCards(state, fight, view.index);
  if (scouted.length > 0) {
    lines.push(ui.scouted(scouted.map((uid) => nameOf(view, state, uid)).join(', ')));
  }
  return lines;
}

export function renderSearch(view: View, state: RunState, choices: readonly number[]): string[] {
  return choices.map((uid, position) => cardLine(view, instanceOf(state, uid), position + 1));
}

/** Aperçu d'une sélection ; la Brume et les cartes cachées le masquent. */
export function renderPreview(
  view: View,
  fight: FightState,
  uids: readonly number[],
  result: ScoreResult,
): string {
  const { ui, combos } = view.text;
  const masked = currentRules(fight).hideCombo || uids.some((uid) => isHidden(fight, uid));
  if (masked) return ui.previewHidden;
  return ui.previewLine(combos[result.countedCombo], result.score, result.damage, result.mult);
}

function parts(view: View, step: Extract<ScoreStep, { kind: 'card' | 'tool' }>): string {
  const pieces: string[] = [];
  if (step.kind === 'card') pieces.push(SIGN(step.damage));
  const { mult } = view.text.ui;
  if (step.addMult !== 0) pieces.push(`${SIGN(step.addMult)} ${mult}`);
  if (step.timesMult !== 1) pieces.push(`×${step.timesMult} ${mult}`);
  if (step.kind === 'card' && step.talent) pieces.push(view.text.families[step.talent].name);
  return pieces.join(', ');
}

function renderStep(view: View, state: RunState, step: ScoreStep): string {
  const { ui, combos } = view.text;
  switch (step.kind) {
    case 'combo':
      return ui.stepCombo(combos[step.combo], step.damage, step.mult);
    case 'card':
      return ui.stepCard(nameOf(view, state, step.uid), parts(view, step));
    case 'silenced':
      return ui.stepSilenced(nameOf(view, state, step.uid));
    case 'tool': {
      const tool = state.tools.find((entry) => entry.uid === step.uid);
      return ui.stepTool(tool ? toolName(view, tool) : '?', parts(view, step));
    }
    case 'damageChange':
      if (step.source === 'furnace') return ui.stepFurnace(step.amount);
      if (step.source === 'counterAttack') return ui.stepCounterAttack(step.amount);
      if (step.source === 'resistance') return ui.stepResistance(step.amount);
      return ui.stepLoss(step.amount);
    case 'multChange':
      return ui.stepPenalty(step.amount);
    case 'weakness':
      return ui.stepWeakness(step.times);
  }
}

export function renderScore(view: View, state: RunState, result: ScoreResult): string[] {
  const lines = result.steps.map((step) => renderStep(view, state, step));
  lines.push(view.text.ui.stepTotal(result.damage, result.mult, result.score));
  if (result.flatDamage > 0) lines.push(view.text.ui.stepFlat(result.flatDamage));
  return lines;
}

export function renderEvent(view: View, state: RunState, event: GameEvent): string[] {
  const { ui, statuses, types } = view.text;
  const named = (uid: number) => nameOf(view, state, uid);
  const byId = (id: string) => {
    const card = view.index.byId.get(id);
    return card ? card.name[view.language] : id;
  };
  switch (event.type) {
    case 'fightStarted':
      return [];
    case 'turnStarted':
      return [ui.eventTurn(event.turn)];
    case 'statusAnnounced':
      return [ui.eventAnnounced(statuses[event.id].name)];
    case 'statusCancelled':
      return [ui.eventCancelled(statuses[event.id].name)];
    case 'statusRolled':
      return STATUSES[event.id].roll === 'none'
        ? []
        : [ui.eventRolled(statuses[event.id].name, event.success, event.rolled)];
    case 'statusCopied':
      return [ui.eventCopied(statuses[event.id].name)];
    case 'opponentHealed':
      return [ui.eventHealed(event.amount)];
    case 'moneyLost':
      return [ui.eventMoneyLost(event.amount)];
    case 'retreatLost':
      return [ui.eventRetreatLost(event.amount)];
    case 'handBurned':
      return [ui.eventBurned(named(event.uid), event.banished)];
    case 'handReturned':
      return [ui.eventReturned(event.uids.length)];
    case 'handPlayed':
      return renderScore(view, state, event.result);
    case 'opponentDamaged':
      return [ui.eventDamaged(event.amount, event.hp)];
    case 'afflictionTick':
      return [ui.eventAffliction(event.amount)];
    case 'discarded':
      return [ui.eventDiscarded(event.uids.length, event.cost, event.money)];
    case 'cardRecovered':
      return [ui.eventRecovered(named(event.uid))];
    case 'cardEvolved':
      return [ui.eventEvolved(byId(event.fromId), byId(event.toId))];
    case 'energyAttached':
      return [ui.eventEnergy(named(event.uid), types[event.energy])];
    case 'swapped':
      return [ui.eventSwapped(named(event.uid), named(event.drawnUid))];
    case 'searchResolved':
      return [ui.eventSearched(named(event.uid))];
    case 'fightWon':
      return [ui.eventWon(event.gains)];
    case 'fightLost':
      return [ui.eventLost];
    case 'fightSkipped':
      return [ui.eventSkipped];
    case 'arenaCleared':
      return [ui.eventArena(event.arenaIndex + 1)];
    case 'runWon':
      return [ui.eventRunWon];
  }
}

export function renderShop(view: View, state: RunState, shop: ShopState): string[] {
  const { ui, toolRarities } = view.text;
  const lines = ['', ui.shopHeader(state.money)];
  shop.slots.forEach((slot, position) => {
    if (!slot) {
      lines.push(ui.shopEmpty(position + 1));
    } else if (slot.kind === 'card') {
      const entry = { uid: -1, cardId: slot.cardId, variant: slot.variant, energies: [] };
      lines.push(ui.shopCard(position + 1, cardText(view, entry), slot.price));
    } else {
      const { effect } = view.text.tools[slot.toolId];
      const rarity = toolRarities[TOOLS[slot.toolId].rarity];
      lines.push(
        ui.shopTool(
          position + 1,
          ui.labeled(`${toolName(view, slot)} (${rarity})`, effect),
          slot.price,
        ),
      );
    }
  });
  shop.boosters.forEach((booster, position) => {
    if (!booster) return;
    const name = booster.kind === 'set' ? ui.boosterSet : ui.boosterEnergy;
    lines.push(ui.shopBooster(position + 1, name, booster.price));
  });
  lines.push(ui.shopReroll(shop.rerollCost));
  if (state.tools.length > 0) {
    lines.push(ui.ownedTools);
    state.tools.forEach((tool, position) => {
      lines.push(`  ${position + 1}. ${toolName(view, tool)}`);
    });
  }
  return lines;
}

export function renderBooster(view: View, booster: OpenBooster): string[] {
  const { types } = view.text;
  if (booster.kind === 'energy') {
    return booster.energies.map((energy, position) => `  ${position + 1}. ${types[energy]}`);
  }
  return booster.cards.map((entry, position) =>
    cardLine(view, { uid: -1, ...entry, energies: [] }, position + 1),
  );
}
