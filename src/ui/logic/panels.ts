/** Panneau global ouvert par-dessus le jeu. */
import { writable } from 'svelte/store';

export type Panel = 'settings' | 'help' | 'about' | 'deck';

export const panel = writable<Panel | null>(null);
