/** Extensions jouables, dans l'ordre du Classeur. Seule la première est ouverte au départ. */
export interface SetDef {
  id: string;
  /** Série TCGdex, pour l'adresse des images. */
  series: string;
}

export const SETS: readonly SetDef[] = [
  { id: 'sm12', series: 'sm' },
  { id: 'sm1', series: 'sm' },
  { id: 'sm2', series: 'sm' },
];

export const STARTING_SET = 'sm12';

/** Part d'une extension à découvrir pour y choisir ses lignées de départ. */
export const CUSTOM_DECK_RATIO = 0.25;
