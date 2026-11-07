/** Instance unique de la partie pour l'application. */
import type { Language } from '../../content/i18n/index.ts';
import { type CardData, cardOf, instanceOf, isHidden, type RunState } from '../../engine/index.ts';
import { cardIndex, indexOfSet, seriesOf, setIdOf } from './data.ts';
import { cardImageUrl, type ImageQuality, preloadImages } from './images.ts';
import { Progress } from './progress.ts';
import {
  indexedDbMetaStore,
  indexedDbStore,
  type MetaStore,
  memoryMetaStore,
  memoryStore,
  type SaveStore,
} from './save.ts';
import { Session } from './session.ts';
import { currentTexts, speedFactor } from './settings.ts';
import { showToast } from './toasts.ts';

function saveStore(): SaveStore {
  return typeof indexedDB === 'undefined' ? memoryStore() : indexedDbStore();
}

function metaStore(): MetaStore {
  return typeof indexedDB === 'undefined' ? memoryMetaStore() : indexedDbMetaStore();
}

export function imageOf(card: CardData, quality: ImageQuality, language: Language): string {
  const id = setIdOf(card.id);
  return cardImageUrl(card, { id, series: seriesOf(id) }, language, quality);
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

export const progress = new Progress({
  store: metaStore(),
  onReached: (id) => {
    const { app, objectives } = currentTexts().text;
    showToast(app.objectiveReached(objectives[id].name));
  },
});

export const session = new Session({
  indexFor: indexOfSet,
  store: saveStore(),
  speed: speedFactor,
  texts: currentTexts,
  onCommit: preloadHand,
  onProgress: (state, events, index) => progress.observe(state, events, index),
});
