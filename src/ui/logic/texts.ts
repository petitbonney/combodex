/** Textes de la langue choisie, réactifs pour les composants. */
import { derived } from 'svelte/store';
import { messagesFor } from '../../content/i18n/index.ts';
import { settings } from './settings.ts';

export const texts = derived(settings, ({ language }) => ({
  language,
  text: messagesFor(language),
}));
