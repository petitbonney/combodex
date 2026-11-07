/** Messages brefs affichés au-dessus du jeu. */
import { writable } from 'svelte/store';

export interface Toast {
  id: number;
  text: string;
}

const DURATION = 2600;
let nextId = 1;

export const toasts = writable<Toast[]>([]);

export function showToast(text: string): void {
  const id = nextId++;
  toasts.update((items) => [...items.filter((item) => item.text !== text), { id, text }]);
  setTimeout(() => toasts.update((items) => items.filter((item) => item.id !== id)), DURATION);
}
