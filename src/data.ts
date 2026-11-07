/** Chargement du JSON de cartes pour les outils en ligne de commande. */
import { readFileSync } from 'node:fs';
import { type CardIndex, type CardSet, indexCards } from './engine/cards.ts';

export function loadCards(path = 'data/sm12.json'): CardIndex {
  const set = JSON.parse(readFileSync(path, 'utf8')) as CardSet;
  return indexCards(set);
}
