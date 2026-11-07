/** Règles qui s'appliquent à la main en cours, selon l'effet permanent et le statut du Tour. */
import {
  FIGHTING_MAX_SCORING,
  HAND_SIZE,
  METAL_COMBO_FACTOR,
  RESISTANCE_DAMAGE,
} from '../content/balance.ts';
import { STATUSES, type StatusId } from '../content/statuses.ts';
import type { PokemonType } from './cards.ts';
import type { ActiveStatus, FightState } from './state.ts';

export type ToolOrder = 'normal' | 'timesFirst' | 'random';

export interface HandRules {
  /** Seules les N premières cartes posées marquent (statut). */
  maxScoring: number | null;
  /** Même limite venant de l'effet permanent : Protection ne l'ignore pas. */
  permanentMaxScoring: number | null;
  /** Les N premières cartes posées ne marquent rien. */
  silencedFirst: number;
  /** N cartes posées au hasard ne marquent rien. */
  silencedRandom: number;
  shufflePlayed: boolean;
  noScoreTypes: PokemonType[];
  damagePenaltyPerCard: number;
  energyDamageOff: boolean;
  energyTypeOff: boolean;
  retreatZeroNoDamage: boolean;
  retreatZeroNoVariant: boolean;
  /** Facteur de Dégâts des cartes à retraite 3 ou plus. */
  heavyDamageFactor: number;
  /** Part des Dégâts perdue par la main, sans condition. */
  damageLoss: number;
  /** Part des Dégâts perdue sans carte du type faible du Champion. */
  counterAttackLoss: number;
  multPenalty: number;
  /** Malus de Multi sur la combinaison la plus jouée de la run. */
  mostPlayedMultPenalty: number;
  /** Facteur sur la combinaison la plus jouée de la run (1 : sans effet). */
  mostPlayedFactor: number;
  variantsOff: boolean;
  collectionToolsOff: boolean;
  typeToolsOff: boolean;
  weaknessToolsOff: boolean;
  weaknessOff: boolean;
  toolOrder: ToolOrder;
  resistanceAllTypes: boolean;
  resistanceDamage: number;
  resistanceFactor: number;
  /** Part des PV max absorbée par le Champion à cette main. */
  absorbPercent: number;
  comboDemotion: number;
  retreatCostBonus: number;
  handLimit: number;
  hideCombo: boolean;
  hideCardDamage: boolean;
}

export function defaultRules(): HandRules {
  return {
    maxScoring: null,
    permanentMaxScoring: null,
    silencedFirst: 0,
    silencedRandom: 0,
    shufflePlayed: false,
    noScoreTypes: [],
    damagePenaltyPerCard: 0,
    energyDamageOff: false,
    energyTypeOff: false,
    retreatZeroNoDamage: false,
    retreatZeroNoVariant: false,
    heavyDamageFactor: 1,
    damageLoss: 0,
    counterAttackLoss: 0,
    multPenalty: 0,
    mostPlayedMultPenalty: 0,
    mostPlayedFactor: 1,
    variantsOff: false,
    collectionToolsOff: false,
    typeToolsOff: false,
    weaknessToolsOff: false,
    weaknessOff: false,
    toolOrder: 'normal',
    resistanceAllTypes: false,
    resistanceDamage: RESISTANCE_DAMAGE,
    resistanceFactor: 1,
    absorbPercent: 0,
    comboDemotion: 0,
    retreatCostBonus: 0,
    handLimit: HAND_SIZE,
    hideCombo: false,
    hideCardDamage: false,
  };
}

/** Effet permanent du type de l'Arène sur la main. */
export function applyPermanentRules(rules: HandRules, type: PokemonType): void {
  switch (type) {
    case 'Water':
      rules.noScoreTypes = ['Fire'];
      break;
    case 'Fighting':
      rules.permanentMaxScoring = FIGHTING_MAX_SCORING;
      break;
    case 'Metal':
      rules.mostPlayedFactor = METAL_COMBO_FACTOR;
      break;
    case 'Fairy':
      rules.variantsOff = true;
      break;
    case 'Dragon':
      rules.weaknessOff = true;
      break;
    case 'Colorless':
      rules.typeToolsOff = true;
      break;
    // Effets hors du calcul de la main : voir fight.ts.
    case 'Grass':
    case 'Fire':
    case 'Lightning':
    case 'Psychic':
    case 'Darkness':
      break;
  }
}

/** Effet d'un statut sur la main ; les effets sur la main ou les PV sont dans fight.ts. */
export function applyStatusRules(rules: HandRules, id: StatusId, strong: boolean): void {
  const def = STATUSES[id];
  const value = strong ? def.strong : def.base;
  switch (id) {
    case 'roots':
      rules.retreatCostBonus = value;
      break;
    case 'vines':
      rules.handLimit = value;
      break;
    case 'furnace':
      rules.damagePenaltyPerCard = value;
      break;
    case 'ashes':
      rules.energyDamageOff = true;
      rules.energyTypeOff = strong;
      break;
    case 'mist':
      rules.hideCombo = true;
      rules.hideCardDamage = strong;
      break;
    case 'overload':
      rules.toolOrder = strong ? 'random' : 'timesFirst';
      break;
    case 'static':
      rules.retreatZeroNoDamage = true;
      rules.retreatZeroNoVariant = strong;
      break;
    case 'confusion':
      rules.shufflePlayed = true;
      rules.silencedRandom += value;
      break;
    case 'premonition':
      rules.mostPlayedMultPenalty = value;
      break;
    case 'intimidation':
      rules.multPenalty = value;
      break;
    case 'highGuard':
      rules.maxScoring = value;
      break;
    case 'counterAttack':
      rules.counterAttackLoss = value;
      break;
    case 'armor':
      rules.absorbPercent = value;
      break;
    case 'plating':
      rules.resistanceFactor = value;
      break;
    case 'heaviness':
      rules.heavyDamageFactor = value;
      break;
    case 'charm':
      rules.collectionToolsOff = true;
      rules.variantsOff = rules.variantsOff || strong;
      break;
    case 'veil':
      rules.silencedFirst = value;
      break;
    case 'scales':
      rules.weaknessOff = true;
      rules.weaknessToolsOff = strong;
      break;
    case 'fury':
      rules.resistanceAllTypes = true;
      rules.resistanceDamage = value;
      break;
    case 'wrath':
      rules.comboDemotion = value;
      break;
    case 'slam':
      rules.damageLoss = 1 - (1 - rules.damageLoss) * (1 - value);
      break;
    case 'howl':
      rules.silencedRandom += value;
      break;
    // Effets appliqués au début du Tour, sans règle de main.
    case 'photosynthesis':
    case 'burn':
    case 'tide':
    case 'current':
    case 'paralysis':
    case 'hypnosis':
    case 'poison':
    case 'theft':
    case 'ambush':
    case 'attract':
    case 'mimic':
      break;
  }
}

/** Règles de la main en cours du combat. */
export function currentRules(fight: FightState): HandRules {
  const rules = defaultRules();
  if (fight.opponent.form === 'permanent') applyPermanentRules(rules, fight.opponent.type);
  const active: ActiveStatus | null = fight.activeStatus;
  if (active) applyStatusRules(rules, active.id, active.strong);
  rules.damageLoss = 1 - (1 - rules.damageLoss) * (1 - fight.poisonPercent);
  return rules;
}
