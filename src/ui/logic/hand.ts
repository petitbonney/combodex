/** Ordre de la main et sélection : de la présentation, aucune règle du jeu. */
import {
  type CardIndex,
  cardOf,
  instanceOf,
  POKEMON_TYPES,
  type RunState,
} from '../../engine/index.ts';

/** Garde l'ordre choisi par le joueur et ajoute les nouvelles cartes à droite. */
export function syncOrder(order: readonly number[], hand: readonly number[]): number[] {
  const kept = order.filter((uid) => hand.includes(uid));
  return [...kept, ...hand.filter((uid) => !kept.includes(uid))];
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  const [moved] = result.splice(from, 1);
  if (moved === undefined) return result;
  result.splice(to, 0, moved);
  return result;
}

/** Sélectionne ou retire une carte ; au-delà de `max`, la sélection ne change pas. */
export function toggleSelection(selected: readonly number[], uid: number, max: number): number[] {
  if (selected.includes(uid)) return selected.filter((other) => other !== uid);
  return selected.length < max ? [...selected, uid] : [...selected];
}

export type SortMode = 'type' | 'line';

/** Nom de la Base de la lignée, en remontant les pré-évolutions connues. */
function lineRoot(index: CardIndex, name: string, parent: string | null): string {
  let root = name;
  for (let next = parent; next !== null; ) {
    root = next;
    next = index.byEnglishName.get(next)?.[0]?.evolveFrom ?? null;
  }
  return root;
}

const STAGE_RANK = { Basic: 0, Stage1: 1, Stage2: 2 } as const;

/** Les cartes cachées restent à droite : un tri ne doit rien révéler d'elles. */
export function sortHand(
  order: readonly number[],
  state: RunState,
  index: CardIndex,
  mode: SortMode,
  isHiddenCard: (uid: number) => boolean,
): number[] {
  const visible = order.filter((uid) => !isHiddenCard(uid));
  const hidden = order.filter((uid) => isHiddenCard(uid));
  const keyed = visible.map((uid) => {
    const card = cardOf(index, instanceOf(state, uid));
    const type = POKEMON_TYPES.indexOf(card.types[0] ?? 'Colorless');
    const root = lineRoot(index, card.name.en, card.evolveFrom);
    return { uid, card, type, root };
  });
  keyed.sort((a, b) => {
    if (mode === 'type' && a.type !== b.type) return a.type - b.type;
    const byRoot = a.root.localeCompare(b.root);
    if (byRoot !== 0) return byRoot;
    if (a.type !== b.type) return a.type - b.type;
    const byStage = STAGE_RANK[a.card.stage] - STAGE_RANK[b.card.stage];
    return byStage !== 0 ? byStage : a.uid - b.uid;
  });
  return [...keyed.map(({ uid }) => uid), ...hidden];
}
