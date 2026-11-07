/** Adresses des visuels TCGdex et préchargement de la main. */
import type { Language } from '../../content/i18n/index.ts';
import type { CardData } from '../../engine/index.ts';

export type ImageQuality = 'low' | 'high';

const ASSETS = 'https://assets.tcgdex.net';

export function cardImageUrl(
  card: Pick<CardData, 'localId'>,
  set: { series: string; id: string },
  language: Language,
  quality: ImageQuality,
): string {
  return `${ASSETS}/${language}/${set.series}/${set.id}/${card.localId}/${quality}.webp`;
}

/** Garde les images en vie le temps du chargement ; elles restent ensuite dans le cache. */
const pending = new Set<HTMLImageElement>();

/** Précharge des images ; le jeu ne l'appelle que pour la main en cours. */
export function preloadImages(urls: readonly string[]): void {
  for (const url of urls) {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    const done = () => pending.delete(image);
    image.onload = done;
    image.onerror = done;
    pending.add(image);
    image.src = url;
  }
}
