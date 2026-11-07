/** Panneau global ouvert par-dessus le jeu. */
import { writable } from 'svelte/store';

export type Panel = 'settings' | 'help' | 'about' | 'deck' | 'daily';

export const panel = writable<Panel | null>(null);

/** Écran affiché hors d'une run. */
export type MenuScreen = 'title' | 'setup' | 'binder';

export const menuScreen = writable<MenuScreen>('title');
