/** Une carte glisse de la main à la zone de jeu ; une carte piochée monte depuis le bas. */
import { cubicOut } from 'svelte/easing';
import { crossfade, fly } from 'svelte/transition';

export const [send, receive] = crossfade({
  duration: 220,
  easing: cubicOut,
  fallback: (node) => fly(node, { y: 120, duration: 260, opacity: 0, easing: cubicOut }),
});
