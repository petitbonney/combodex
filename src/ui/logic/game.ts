/** Instance unique de la partie pour l'application. */
import type { Language } from '../../content/i18n/index.ts';
import { type CardData, cardOf, instanceOf, isHidden, type RunState } from '../../engine/index.ts';
import { cardIndex, seriesOf } from './data.ts';
import { cardImageUrl, type ImageQuality, preloadImages } from './images.ts';
import { indexedDbStore, memoryStore, type SaveStore } from './save.ts';
import { Session } from './session.ts';
import { currentTexts, speedFactor } from './settings.ts';

function saveStore(): SaveStore {
  return typeof indexedDB === 'undefined' ? memoryStore() : indexedDbStore();
}

const setRef = { id: cardIndex.set.id, series: seriesOf(cardIndex.set.id) };

export function imageOf(card: CardData, quality: ImageQuality, language: Language): string {
  return cardImageUrl(card, setRef, language, quality);
}

/** Seule la main est préchargée : le reste se charge quand il s'affiche. */
function preloadHand(state: RunState): void {
  const { fight } = state;
  if (!fight) return;
  const visible = fight.hand.filter((uid) => !isHidden(fight, uid));
  const { language } = currentTexts();
  preloadImages(
    visible.map((uid) => imageOf(cardOf(cardIndex, instanceOf(state, uid)), 'low', language)),
  );
}

export const session = new Session({
  index: cardIndex,
  store: saveStore(),
  speed: speedFactor,
  texts: currentTexts,
  onCommit: preloadHand,
});
