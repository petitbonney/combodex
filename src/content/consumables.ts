/** Énergies spéciales et ACE SPEC. Leurs textes sont dans i18n, leurs effets dans le moteur. */

/** Effet porté par une carte et appliqué quand elle marque ; `light` joue sur la retraite. */
export const SPECIAL_ENERGY_IDS = [
  'double',
  'rainbow',
  'force',
  'shield',
  'light',
  'fortune',
  'echo',
] as const;
export type SpecialEnergyId = (typeof SPECIAL_ENERGY_IDS)[number];

export const ACE_SPEC_IDS = [
  'goldenHand',
  'energyRain',
  'secondWind',
  'duplicator',
  'bigCleanup',
  'printingPress',
  'jackpot',
  'legendaryPull',
] as const;
export type AceSpecId = (typeof ACE_SPEC_IDS)[number];

/** Moment où un ACE SPEC s'utilise. */
export type AceTiming = 'fight' | 'outsideFight' | 'anytime';

export interface AceSpecDef {
  id: AceSpecId;
  timing: AceTiming;
  /** Cartes du deck à désigner. */
  targets: number;
}

export const ACE_SPECS: Record<AceSpecId, AceSpecDef> = {
  goldenHand: { id: 'goldenHand', timing: 'fight', targets: 0 },
  energyRain: { id: 'energyRain', timing: 'fight', targets: 0 },
  secondWind: { id: 'secondWind', timing: 'fight', targets: 0 },
  duplicator: { id: 'duplicator', timing: 'outsideFight', targets: 1 },
  bigCleanup: { id: 'bigCleanup', timing: 'outsideFight', targets: 3 },
  printingPress: { id: 'printingPress', timing: 'outsideFight', targets: 1 },
  jackpot: { id: 'jackpot', timing: 'anytime', targets: 0 },
  legendaryPull: { id: 'legendaryPull', timing: 'outsideFight', targets: 0 },
};
