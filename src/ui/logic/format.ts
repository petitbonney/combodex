/** Mise en forme des nombres selon la langue. */
import type { Language } from '../../content/i18n/index.ts';

const LOCALES: Record<Language, string> = { fr: 'fr-FR', en: 'en-US' };

export function formatNumber(value: number, language: Language): string {
  return new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: 1 }).format(value);
}

/** Un bonus de score, par exemple « +60 », « +4 Multi » ou « ×2 Multi ». */
export function formatBonus(
  parts: { damage?: number; addMult: number; timesMult: number },
  mult: string,
  language: Language,
): string {
  const pieces: string[] = [];
  if (parts.damage) pieces.push(`+${formatNumber(parts.damage, language)}`);
  if (parts.addMult) pieces.push(`+${formatNumber(parts.addMult, language)} ${mult}`);
  if (parts.timesMult !== 1) pieces.push(`×${formatNumber(parts.timesMult, language)} ${mult}`);
  return pieces.join(' ');
}
