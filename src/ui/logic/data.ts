/** Données des extensions, intégrées au jeu : seul le visuel des cartes vient du réseau. */
import sm1 from '../../../data/sm1.json';
import sm2 from '../../../data/sm2.json';
import sm12 from '../../../data/sm12.json';
import { SETS } from '../../content/sets.ts';
import { type CardIndex, type CardSet, indexCards } from '../../engine/index.ts';

const RAW_SETS: Record<string, unknown> = { sm1, sm2, sm12 };

const indexes = new Map(
  SETS.map(({ id }) => [id, indexCards(RAW_SETS[id] as unknown as CardSet)] as const),
);

/** Index d'une extension, celui que reçoit le moteur pendant une run. */
export function indexOfSet(setId: string): CardIndex {
  const index = indexes.get(setId);
  if (!index) throw new Error(`Extension inconnue : ${setId}`);
  return index;
}

/** Toutes les cartes de toutes les extensions, pour l'affichage : leurs identifiants sont uniques. */
export const cardIndex: CardIndex = indexCards({
  id: 'all',
  name: { fr: '', en: '' },
  sourceCommit: '',
  cards: SETS.flatMap(({ id }) => indexOfSet(id).set.cards),
});

/** L'extension d'une carte, tirée de son identifiant. */
export function setIdOf(cardId: string): string {
  return cardId.slice(0, cardId.lastIndexOf('-'));
}

export function seriesOf(setId: string): string {
  return SETS.find((set) => set.id === setId)?.series ?? 'sm';
}
