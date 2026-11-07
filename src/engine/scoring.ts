/**
 * Calcul du score : (Dégâts de la combinaison + dégâts des cartes) × (Multi + ΣMulti) × ΠMulti.
 * Fonction pure de ses entrées ; sans générateur, elle estime la main sans jet ni hasard.
 */
import {
  COIN_FLIP_TIMES,
  COUNTERS_PERCENT,
  ENERGY_DAMAGE,
  FIRST_EDITION_TIMES,
  GENERIC_MULT,
  HOLO_MULT,
  POWER_DAMAGE,
  REVERSE_DAMAGE,
  WEAKNESS_TIMES,
} from '../content/balance.ts';
import { TOOLS, type ToolContext, type ToolInstance } from '../content/tools.ts';
import type { AbilityFamily, CardData, CardIndex, CardInstance, PokemonType } from './cards.ts';
import { cardOf, evolvesFrom } from './cards.ts';
import { COMBO_VALUES, type ComboCard, type ComboId, demoteCombo, detectCombo } from './combos.ts';
import { coinFlip, type Rng, sample, shuffle } from './rng.ts';
import type { HandRules } from './rules.ts';

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
  | { kind: 'tool'; uid: number; addMult: number; timesMult: number }
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
  damage: number;
  mult: number;
  /** Score de la main, retiré des PV. */
  score: number;
  /** Dégâts hors calcul (Marqueurs). */
  flatDamage: number;
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

  const ordered = rules.shufflePlayed && rng ? shuffle(rng, input.played) : [...input.played];
  const cards: PlayedCard[] = ordered.map((instance) => {
    const data = cardOf(index, instance);
    return {
      instance,
      data,
      types: effectiveTypes(data, instance, rules),
      shielded: data.abilityFamily === 'shield',
    };
  });

  const comboCards: ComboCard[] = cards.map(({ data, types }) => ({
    data,
    types,
    wildcard: data.abilityFamily === 'versatile' || (colorlessWild && types.includes('Colorless')),
    strength: countsHp ? data.hp : data.bestDamage,
  }));
  const { combo, scoring } = detectCombo(comboCards);
  const countedCombo = demoteCombo(combo, rules.comboDemotion);
  const silenced = silencedPositions(cards, scoring, input);
  const marking = scoring.filter((position) => !silenced.has(position));

  const steps: ScoreStep[] = [];
  const mostPlayed = mostPlayedCombos(input.comboCounts).has(combo);
  const comboFactor = mostPlayed ? rules.mostPlayedFactor : 1;
  const comboDamage = Math.floor(COMBO_VALUES[countedCombo].damage * comboFactor);
  const comboMult = Math.max(1, Math.floor(COMBO_VALUES[countedCombo].mult * comboFactor));
  steps.push({ kind: 'combo', combo: countedCombo, damage: comboDamage, mult: comboMult });

  let damage = comboDamage;
  let mult = comboMult;
  let cardTimes = 1;
  let flatDamage = 0;
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
      steps.push({ kind: 'silenced', uid: instance.uid });
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
    }

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
    steps.push({
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
    steps.push({ kind: 'multChange', source: 'penalty', amount: -multPenalty });
  }

  // Les Outils se déclenchent de gauche à droite : les +Multi, puis les ×Multi.
  const distinct = new Set(input.seenDexIds);
  for (const { data } of cards) for (const dexId of data.dexIds) distinct.add(dexId);
  const contextFor = (tool: ToolInstance): ToolContext => ({
    tool,
    index,
    combo,
    played: cards,
    scoring: marking.map((position) => cards[position] as PlayedCard),
    colorlessWild,
    variantsOff: rules.variantsOff,
    distinctPokemon: distinct.size,
  });
  const toolAdd = (tool: ToolInstance) => TOOLS[tool.toolId].addMult?.(contextFor(tool)) ?? 0;
  const toolTimes = (tool: ToolInstance) => TOOLS[tool.toolId].timesMult?.(contextFor(tool)) ?? 1;
  const triggerAdd = (tool: ToolInstance) => {
    const addMult = toolAdd(tool);
    mult += addMult;
    if (addMult !== 0) steps.push({ kind: 'tool', uid: tool.uid, addMult, timesMult: 1 });
  };
  const triggerTimes = (tool: ToolInstance) => {
    const timesMult = toolTimes(tool);
    mult *= timesMult;
    if (timesMult !== 1) steps.push({ kind: 'tool', uid: tool.uid, addMult: 0, timesMult });
  };

  if (rules.toolOrder === 'normal') {
    tools.forEach(triggerAdd);
    mult *= cardTimes;
    tools.forEach(triggerTimes);
  } else if (rules.toolOrder === 'timesFirst') {
    mult *= cardTimes;
    tools.forEach(triggerTimes);
    tools.forEach(triggerAdd);
  } else {
    mult *= cardTimes;
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
    steps.push({ kind: 'damageChange', source: 'furnace', amount: -amount });
  }
  if (rules.damageLoss > 0) {
    const amount = Math.floor(damage * rules.damageLoss);
    damage -= amount;
    steps.push({ kind: 'damageChange', source: 'loss', amount: -amount });
  }
  const hitsWeakness = cards.some((card) =>
    card.types.some((type) => opponent.weaknesses.includes(type)),
  );
  if (rules.counterAttackLoss > 0 && !hitsWeakness) {
    const amount = Math.floor(damage * rules.counterAttackLoss);
    damage -= amount;
    steps.push({ kind: 'damageChange', source: 'counterAttack', amount: -amount });
  }

  // Faiblesse puis résistance.
  if (hitsWeakness && !rules.weaknessOff) {
    const times = Math.max(WEAKNESS_TIMES, ...defs.map((def) => def.weaknessTimes ?? 0));
    mult *= times;
    steps.push({ kind: 'weakness', times });
  }
  const resisted = cards.filter(
    (card) =>
      !card.shielded &&
      (rules.resistanceAllTypes || card.types.some((type) => opponent.resistances.includes(type))),
  ).length;
  if (resisted > 0) {
    const amount = rules.resistanceDamage * rules.resistanceFactor * resisted;
    damage -= amount;
    steps.push({ kind: 'damageChange', source: 'resistance', amount: -amount });
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
    damage,
    mult,
    score,
    flatDamage,
    effects,
  };
}
