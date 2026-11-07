/** Chargement du JSON de cartes pour les outils en ligne de commande. */
import { readFileSync } from 'node:fs';
import { STARTING_SET } from './content/sets.ts';
import { type CardIndex, type CardSet, indexCards } from './engine/cards.ts';

export function loadCards(setId: string = STARTING_SET): CardIndex {
  const set = JSON.parse(readFileSync(`data/${setId}.json`, 'utf8')) as CardSet;
  return indexCards(set);
}
