/** Réglages du joueur, gardés dans ce navigateur. */
import { get, writable } from 'svelte/store';
import { type Language, type Messages, messagesFor } from '../../content/i18n/index.ts';

export type AnimationSpeed = 'normal' | 'fast' | 'instant';
export type TextSize = 'normal' | 'large';

export interface Settings {
  language: Language;
  speed: AnimationSpeed;
  textSize: TextSize;
}

const KEY = 'combodex.settings';
const SPEED_FACTOR: Record<AnimationSpeed, number> = { normal: 1, fast: 2, instant: 6 };

function browserLanguage(): Language {
  return typeof navigator !== 'undefined' && navigator.language.startsWith('fr') ? 'fr' : 'en';
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function defaults(): Settings {
  return {
    language: browserLanguage(),
    speed: prefersReducedMotion() ? 'instant' : 'normal',
    textSize: 'normal',
  };
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults(), ...(JSON.parse(raw) as Partial<Settings>) } : defaults();
  } catch {
    return defaults();
  }
}

export const settings = writable<Settings>(load());

settings.subscribe((value) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Stockage indisponible : les réglages durent le temps de la session.
  }
});

export function speedFactor(): number {
  return SPEED_FACTOR[get(settings).speed];
}

export function currentTexts(): { language: Language; text: Messages } {
  const { language } = get(settings);
  return { language, text: messagesFor(language) };
}
