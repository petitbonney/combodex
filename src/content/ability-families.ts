/**
 * Classement des talents en familles (voir « Familles de talents » dans le game design).
 * Pur et partagé entre le script de build et les tests.
 */
import type { AbilityFamily } from '../engine/cards.ts';

interface FamilyKeywords {
  family: AbilityFamily;
  fr: string[];
  en: string[];
  /** La famille exige tous ses mots-clés au lieu d'un seul. */
  all?: boolean;
}

/** Ordre de priorité du game design ; la famille Générique n'a pas de mot-clé. */
const FAMILY_KEYWORDS: FamilyKeywords[] = [
  {
    family: 'copy',
    fr: ['utiliser les attaques', "utiliser l'attaque"],
    en: ['use the attacks', 'use the attack', 'use any attack'],
  },
  { family: 'versatile', fr: ['tous les types'], en: ['every type', 'all types'] },
  { family: 'evolution', fr: ['evolu'], en: ['evolve'] },
  {
    family: 'recovery',
    fr: ['pile de defausse', 'dans votre main'],
    en: ['discard pile', 'into your hand'],
    all: true,
  },
  { family: 'counters', fr: ['marqueurs de degats'], en: ['damage counters'] },
  {
    family: 'affliction',
    fr: ['empoisonne', 'brule', 'endormi', 'paralyse', 'confus'],
    en: ['poisoned', 'burned', 'asleep', 'paralyzed', 'confused'],
  },
  {
    family: 'shield',
    fr: ['evitez', 'prevenez', 'ne peut pas etre affecte'],
    en: ['prevent', "can't be affected"],
  },
  { family: 'heal', fr: ['soign'], en: ['heal'] },
  { family: 'energy', fr: ['attach', 'carte energie'], en: ['attach', 'energy card'] },
  { family: 'search', fr: ['cherch'], en: ['search'] },
  {
    family: 'scout',
    fr: ['regardez', 'dessus de votre deck'],
    en: ['look at', 'top of your deck'],
  },
  { family: 'draw', fr: ['pioch'], en: ['draw'] },
  { family: 'switch', fr: ['echang'], en: ['switch'] },
  { family: 'agility', fr: ['cout de retraite'], en: ['retreat cost'] },
  {
    family: 'power',
    fr: ['degats supplementaires', 'degats de plus'],
    en: ['more damage'],
  },
  { family: 'reward', fr: ['recompense'], en: ['prize'] },
  { family: 'discard', fr: ['defauss'], en: ['discard'] },
  { family: 'bench', fr: ['banc'], en: ['bench'] },
  {
    family: 'coinFlip',
    fr: ['lancez une piece', 'pile ou face'],
    en: ['flip a coin'],
  },
];

/** Minuscules, sans accents, apostrophes typographiques redressées. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’`]/g, "'")
    .toLowerCase();
}

/** Renvoie la famille reconnue, ou `null` si aucun mot-clé n'apparaît (effet Générique). */
export function classifyAbility(text: string, language: 'fr' | 'en'): AbilityFamily | null {
  const normalized = normalizeText(text);
  for (const entry of FAMILY_KEYWORDS) {
    const keywords = entry[language].map(normalizeText);
    const matches = (keyword: string) => normalized.includes(keyword);
    if (entry.all ? keywords.every(matches) : keywords.some(matches)) return entry.family;
  }
  return null;
}
