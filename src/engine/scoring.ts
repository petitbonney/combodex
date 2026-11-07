/**
 * Calcul du score : (Dégâts de la combinaison + dégâts des cartes) × (Multi + ΣMulti) × ΠMulti.
 * Fonction pure de ses entrées ; sans générateur, elle estime la main sans jet ni hasard.
 */
import {
  COIN_FLIP_TIMES,
  COUNTERS_PERCENT,
  DOUBLE_ENERGY_DAMAGE,
  ECHO_ENERGY_TIMES,
  ENERGY_DAMAGE,
  FIRST_EDITION_TIMES,
  FORCE_ENERGY_MULT,
  FORTUNE_ENERGY_MONEY,
  GENERIC_MULT,
  HOLO_MULT,
  MAX_TURNS,
  POWER_DAMAGE,
  REVERSE_DAMAGE,
  WEAKNESS_TIMES,
} from '../content/balance.ts';
import type { SpecialEnergyId } from '../content/consumables.ts';
import { TOOLS, type ToolContext, type ToolInstance } from '../content/tools.ts';
import type { AbilityFamily, CardData, CardIndex, CardInstance, PokemonType } from './cards.ts';
import { cardOf, evolvesFrom } from './cards.ts';
import { COMBO_VALUES, type ComboCard, type ComboId, demoteCombo, detectCombo } from './combos.ts';
import { coinFlip, type Rng, sample, shuffle } from './rng.ts';
import type { HandRules } from './rules.ts';
import type { OpponentKind } from './state.ts';

/** Effets de talents à appliquer une fois la main résolue. */
export type TalentEffect = Extract<
  AbilityFamily,
  | 'evolution'
  | 'recovery'
  | 'affliction'
  | 'heal'
  | 'energy'
  | 'search'
  | 'draw'
  | 'reward'
  | 'discard'
>;

const DEFERRED_TALENTS: readonly AbilityFamily[] = [
  'evolution',
  'recovery',
  'affliction',
  'heal',
  'energy',
  'search',
  'draw',
  'reward',
  'discard',
];

export interface ScoreInput {
  index: CardIndex;
  /** Cartes posées, de gauche à droite. */
  played: readonly CardInstance[];
  /** Cartes restées en main. */
  hand: readonly CardInstance[];
  opponent: {
    kind?: OpponentKind;
    /** PV avant cette main ; `maxHp` s'il manque. */
    hp?: number;
    maxHp: number;
    weaknesses: readonly PokemonType[];
    resistances: readonly PokemonType[];
  };
  /** Outils dans l'ordre des emplacements. */
  tools: readonly ToolInstance[];
  /** Outils neutralisés individuellement (Embuscade, effet Obscurité). */
  disabledToolUids: readonly number[];
  rules: HandRules;
  comboCounts: Partial<Record<string, number>>;
  seenDexIds: readonly number[];
  /** ₽ détenus, points de Retraite restants et combats gagnés, lus par certains Outils. */
  money: number;
  retreatPoints: number;
  fightsWon: number;
  /** Tour en cours et nombre de Tours du combat. */
  turn?: number;
  maxTurns?: number;
  /** Cartes du deck. */
  deckSize?: number;
  /** `null` : estimation sans jet. */
  rng: Rng | null;
}

export type ScoreStep =
  | { kind: 'combo'; combo: ComboId; damage: number; mult: number }
  | {
      kind: 'card';
      uid: number;
      damage: number;
      addMult: number;
      timesMult: number;
      talent: AbilityFamily | null;
    }
  | { kind: 'silenced'; uid: number }
  | { kind: 'tool'; uid: number; addMult: number; timesMult: number; addDamage: number }
  /** Les ×Multi des cartes (1re édition, Pile ou face), appliqués avant ceux des Outils. */
  | { kind: 'cardTimes'; times: number }
  | {
      kind: 'damageChange';
      source: 'furnace' | 'loss' | 'counterAttack' | 'resistance';
      amount: number;
    }
  | { kind: 'multChange'; source: 'penalty'; amount: number }
  | { kind: 'weakness'; times: number };

export interface ScoreResult {
  /** Combinaison détectée, avant Colère. */
  combo: ComboId;
  /** Combinaison comptée, après Colère. */
  countedCombo: ComboId;
  /** Ordre réel des cartes, après Confusion. */
  playedUids: number[];
  scoringUids: number[];
  steps: ScoreStep[];
  /** Dégâts et Multi après chaque étape, dans le même ordre que `steps`. */
  running: { damage: number; mult: number }[];
  damage: number;
  mult: number;
  /** Score de la main, retiré des PV. */
  score: number;
  /** Dégâts hors calcul (Marqueurs). */
  flatDamage: number;
  /** ₽ gagnés pendant la main (Énergie Fortune). */
  moneyGained: number;
  effects: TalentEffect[];
}

export function effectiveTypes(
  card: CardData,
  instance: CardInstance,
  rules: HandRules,
): PokemonType[] {
  const energies = rules.energyTypeOff ? [] : instance.energies;
  return [...new Set([...card.types, ...energies])];
}

function mostPlayedCombos(counts: Partial<Record<string, number>>): Set<string> {
  const best = Math.max(0, ...Object.values(counts).map((count) => count ?? 0));
  if (best === 0) return new Set();
  return new Set(Object.keys(counts).filter((combo) => counts[combo] === best));
}

export function activeTools(input: {
  tools: readonly ToolInstance[];
  disabledToolUids: readonly number[];
  rules: HandRules;
}): ToolInstance[] {
  const { tools, disabledToolUids, rules } = input;
  return tools.filter((tool) => {
    const def = TOOLS[tool.toolId];
    if (disabledToolUids.includes(tool.uid)) return false;
    if (rules.collectionToolsOff && def.collection) return false;
    if (rules.typeToolsOff && def.typeBound) return false;
    if (rules.weaknessToolsOff && def.weakness) return false;
    return true;
  });
}

export function hasSpecial(instance: CardInstance, special: SpecialEnergyId): boolean {
  return instance.specials?.includes(special) ?? false;
}

function countSpecial(instance: CardInstance, special: SpecialEnergyId): number {
  return instance.specials?.filter((entry) => entry === special).length ?? 0;
}

interface PlayedCard {
  instance: CardInstance;
  data: CardData;
  types: PokemonType[];
  /** Protection : la carte ignore les statuts et la résistance. */
  shielded: boolean;
}

function silencedPositions(
  cards: readonly PlayedCard[],
  scoring: readonly number[],
  input: ScoreInput,
) {
  const { rules, rng } = input;
  const silenced = new Set<number>();
  scoring.forEach((index) => {
    const card = cards[index] as PlayedCard;
    // Les effets permanents s'appliquent à toutes les cartes.
    const blockedType = card.types.some((type) => rules.noScoreTypes.includes(type));
    const permanentLimit = rules.permanentMaxScoring;
    if (blockedType || (permanentLimit !== null && index >= permanentLimit)) silenced.add(index);
    // Protection ignore les statuts.
    if (card.shielded) return;
    const beyondLimit = rules.maxScoring !== null && index >= rules.maxScoring;
    if (beyondLimit || index < rules.silencedFirst) silenced.add(index);
  });
  if (rng && rules.silencedRandom > 0) {
    const candidates = scoring.filter(
      (index) => !silenced.has(index) && !(cards[index] as PlayedCard).shielded,
    );
    for (const index of sample(rng, candidates, rules.silencedRandom)) silenced.add(index);
  }
  return silenced;
}

export function scoreHand(input: ScoreInput): ScoreResult {
  const { index, hand, opponent, rules, rng } = input;
  const tools = activeTools(input);
  const defs = tools.map((tool) => TOOLS[tool.toolId]);
  const countsHp = defs.some((def) => def.countsHp);
  const colorlessWild = defs.some((def) => def.colorlessWildcard);
  const replaysEvolution = defs.some((def) => def.replaysEvolution);
  const ignoresResistance = defs.some((def) => def.ignoresResistance);

  const ordered = rules.shufflePlayed && rng ? shuffle(rng, input.played) : [...input.played];
  const cards: PlayedCard[] = ordered.map((instance) => {
    const data = cardOf(index, instance);
    return {
      instance,
      data,
      types: effectiveTypes(data, instance, rules),
      shielded: data.abilityFamily === 'shield' || hasSpecial(instance, 'shield'),
    };
  });

  const comboCards: ComboCard[] = cards.map(({ data, types, instance }) => ({
    data,
    types,
    wildcard:
      data.abilityFamily === 'versatile' ||
      hasSpecial(instance, 'rainbow') ||
      (colorlessWild && types.includes('Colorless')),
    strength: countsHp ? data.hp : data.bestDamage,
  }));
  const { combo, scoring } = detectCombo(comboCards);
  const countedCombo = demoteCombo(combo, rules.comboDemotion);
  const silenced = silencedPositions(cards, scoring, input);
  const marking = scoring.filter((position) => !silenced.has(position));

  const steps: ScoreStep[] = [];
  const running: ScoreResult['running'] = [];
  const mostPlayed = mostPlayedCombos(input.comboCounts).has(combo);
  const comboFactor = mostPlayed ? rules.mostPlayedFactor : 1;
  const comboDamage = Math.floor(COMBO_VALUES[countedCombo].damage * comboFactor);
  const comboMult = Math.max(1, Math.floor(COMBO_VALUES[countedCombo].mult * comboFactor));

  let damage = comboDamage;
  let mult = comboMult;
  const record = (step: ScoreStep) => {
    steps.push(step);
    running.push({ damage, mult });
  };
  record({ kind: 'combo', combo: countedCombo, damage: comboDamage, mult: comboMult });
  let cardTimes = 1;
  let flatDamage = 0;
  let moneyGained = 0;
  const effects: TalentEffect[] = [];

  const strongestInHand = Math.max(0, ...hand.map((card) => cardOf(index, card).bestDamage));
  const powerSources = marking
    .map((position) => cards[position] as PlayedCard)
    .filter((card) => card.data.abilityFamily === 'power');

  // Les cartes qui forment la combinaison marquent de gauche à droite.
  scoring.forEach((position) => {
    const card = cards[position] as PlayedCard;
    const { instance, data } = card;
    if (silenced.has(position)) {
      record({ kind: 'silenced', uid: instance.uid });
      return;
    }
    const talent = data.abilityFamily;
    const statusApplies = !card.shielded;
    let cardDamage = data.bestDamage;
    if (talent === 'copy') cardDamage = Math.max(cardDamage, strongestInHand);
    if (countsHp) cardDamage = data.hp;
    if (statusApplies && rules.retreatZeroNoDamage && data.retreat === 0) cardDamage = 0;
    if (statusApplies && data.retreat >= 3)
      cardDamage = Math.floor(cardDamage * rules.heavyDamageFactor);
    if (replaysEvolution && cards.some((other) => evolvesFrom(data, other.data))) {
      cardDamage *= 2;
    }

    let addMult = 0;
    let timesMult = 1;
    const variantApplies =
      !rules.variantsOff && !(statusApplies && rules.retreatZeroNoVariant && data.retreat === 0);
    if (variantApplies) {
      if (instance.variant === 'reverse') cardDamage += REVERSE_DAMAGE;
      if (instance.variant === 'holo') addMult += HOLO_MULT;
      if (instance.variant === 'firstEdition') timesMult *= FIRST_EDITION_TIMES;
    }

    if (!rules.energyDamageOff || card.shielded) {
      cardDamage += ENERGY_DAMAGE * instance.energies.length;
      cardDamage += DOUBLE_ENERGY_DAMAGE * countSpecial(instance, 'double');
    }
    addMult += FORCE_ENERGY_MULT * countSpecial(instance, 'force');
    timesMult *= ECHO_ENERGY_TIMES ** countSpecial(instance, 'echo');
    moneyGained += FORTUNE_ENERGY_MONEY * countSpecial(instance, 'fortune');

    for (const source of powerSources) {
      const sameType = source.types.some((type) => card.types.includes(type));
      if (source !== card && sameType) cardDamage += POWER_DAMAGE;
    }

    if (talent === 'generic') addMult += GENERIC_MULT;
    if (talent === 'bench') addMult += hand.length;
    if (talent === 'coinFlip' && rng && coinFlip(rng)) timesMult *= COIN_FLIP_TIMES;
    if (talent === 'counters') flatDamage += Math.floor(opponent.maxHp * COUNTERS_PERCENT);
    if (talent && DEFERRED_TALENTS.includes(talent)) effects.push(talent as TalentEffect);

    damage += cardDamage;
    mult += addMult;
    cardTimes *= timesMult;
    record({
      kind: 'card',
      uid: instance.uid,
      damage: cardDamage,
      addMult,
      timesMult,
      talent,
    });
  });

  // Malus de Multi avant les Outils.
  const mostPlayedPenalty = mostPlayed ? rules.mostPlayedMultPenalty : 0;
  const multPenalty = rules.multPenalty + mostPlayedPenalty;
  if (multPenalty > 0) {
    mult = Math.max(1, mult - multPenalty);
    record({ kind: 'multChange', source: 'penalty', amount: -multPenalty });
  }

  // Les Outils se déclenchent de gauche à droite : les +Multi, puis les ×Multi.
  const distinct = new Set(input.seenDexIds);
  for (const { data } of cards) for (const dexId of data.dexIds) distinct.add(dexId);
  const hitsWeakness = cards.some((card) =>
    card.types.some((type) => opponent.weaknesses.includes(type)),
  );
  const contextFor = (tool: ToolInstance): ToolContext => ({
    tool,
    index,
    combo,
    played: cards,
    scoring: marking.map((position) => cards[position] as PlayedCard),
    hitsWeakness,
    colorlessWild,
    variantsOff: rules.variantsOff,
    distinctPokemon: distinct.size,
    money: input.money,
    retreatPoints: input.retreatPoints,
    fightsWon: input.fightsWon,
    turn: input.turn ?? 1,
    maxTurns: input.maxTurns ?? MAX_TURNS,
    deckSize: input.deckSize ?? 0,
    opponentKind: opponent.kind ?? 'champion',
    opponentHpRatio: (opponent.hp ?? opponent.maxHp) / opponent.maxHp,
    comboCount: input.comboCounts[combo] ?? 0,
  });
  const toolAdd = (tool: ToolInstance) => TOOLS[tool.toolId].addMult?.(contextFor(tool)) ?? 0;
  const toolTimes = (tool: ToolInstance) => TOOLS[tool.toolId].timesMult?.(contextFor(tool)) ?? 1;
  const toolDamage = (tool: ToolInstance) => TOOLS[tool.toolId].addDamage?.(contextFor(tool)) ?? 0;
  const triggerAdd = (tool: ToolInstance) => {
    const addMult = toolAdd(tool);
    const addDamage = toolDamage(tool);
    mult += addMult;
    damage += addDamage;
    if (addMult !== 0 || addDamage !== 0) {
      record({ kind: 'tool', uid: tool.uid, addMult, timesMult: 1, addDamage });
    }
  };
  const triggerTimes = (tool: ToolInstance) => {
    const timesMult = toolTimes(tool);
    mult *= timesMult;
    if (timesMult !== 1)
      record({ kind: 'tool', uid: tool.uid, addMult: 0, timesMult, addDamage: 0 });
  };
  const applyCardTimes = () => {
    mult *= cardTimes;
    if (cardTimes !== 1) record({ kind: 'cardTimes', times: cardTimes });
  };

  if (rules.toolOrder === 'normal') {
    tools.forEach(triggerAdd);
    applyCardTimes();
    tools.forEach(triggerTimes);
  } else if (rules.toolOrder === 'timesFirst') {
    applyCardTimes();
    tools.forEach(triggerTimes);
    tools.forEach(triggerAdd);
  } else {
    applyCardTimes();
    for (const tool of rng ? shuffle(rng, tools) : tools) {
      triggerAdd(tool);
      triggerTimes(tool);
    }
  }

  // Fournaise et pertes de Dégâts s'appliquent à la main entière.
  if (rules.damagePenaltyPerCard > 0) {
    const exposed = cards.filter((card) => !card.shielded).length;
    const amount = rules.damagePenaltyPerCard * exposed;
    damage -= amount;
    record({ kind: 'damageChange', source: 'furnace', amount: -amount });
  }
  if (rules.damageLoss > 0) {
    const amount = Math.floor(damage * rules.damageLoss);
    damage -= amount;
    record({ kind: 'damageChange', source: 'loss', amount: -amount });
  }
  if (rules.counterAttackLoss > 0 && !hitsWeakness) {
    const amount = Math.floor(damage * rules.counterAttackLoss);
    damage -= amount;
    record({ kind: 'damageChange', source: 'counterAttack', amount: -amount });
  }

  // Faiblesse puis résistance.
  if (hitsWeakness && !rules.weaknessOff) {
    const times = Math.max(WEAKNESS_TIMES, ...defs.map((def) => def.weaknessTimes ?? 0));
    mult *= times;
    record({ kind: 'weakness', times });
  }
  const resisted = ignoresResistance
    ? 0
    : cards.filter(
        (card) =>
          !card.shielded &&
          (rules.resistanceAllTypes ||
            card.types.some((type) => opponent.resistances.includes(type))),
      ).length;
  if (resisted > 0) {
    const amount = rules.resistanceDamage * rules.resistanceFactor * resisted;
    damage -= amount;
    record({ kind: 'damageChange', source: 'resistance', amount: -amount });
  }

  damage = Math.max(0, damage);
  const absorbed = Math.floor(opponent.maxHp * rules.absorbPercent);
  const score = Math.max(0, Math.floor(damage * mult) - absorbed);
  return {
    combo,
    countedCombo,
    playedUids: cards.map((card) => card.instance.uid),
    scoringUids: marking.map((position) => (cards[position] as PlayedCard).instance.uid),
    steps,
    running,
    damage,
    mult,
    score,
    flatDamage,
    moneyGained,
    effects,
  };
}
