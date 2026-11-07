import { en } from './en.ts';
import { fr } from './fr.ts';
import type { Language, Messages } from './messages.ts';

export type { Language, Messages } from './messages.ts';

export function messagesFor(language: Language): Messages {
  return language === 'en' ? en : fr;
}
