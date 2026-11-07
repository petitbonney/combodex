/** Données de l'extension, intégrées au jeu : seul le visuel des cartes vient du réseau. */
import rawSet from '../../../data/sm12.json';
import { type CardIndex, type CardSet, indexCards } from '../../engine/index.ts';

export const cardIndex: CardIndex = indexCards(rawSet as unknown as CardSet);

/** Série TCGdex de chaque extension jouable, pour construire l'adresse des images. */
const SERIES: Record<string, string> = { sm12: 'sm' };

export function seriesOf(setId: string): string {
  return SERIES[setId] ?? 'sm';
}
