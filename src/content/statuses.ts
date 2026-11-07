/** Statuts par Tour et effets permanents des Champions. Les textes sont dans i18n. */
import type { PokemonType } from '../engine/cards.ts';

export type StatusRoll = 'none' | 'coin' | 'die3' | 'die4';

export interface StatusDef {
  id: StatusId;
  type: PokemonType;
  roll: StatusRoll;
  /** Valeur de base et valeur renforcée ; leur sens dépend du statut. */
  base: number;
  strong: number;
}

export const STATUS_IDS = [
  'photosynthesis',
  'roots',
  'vines',
  'burn',
  'furnace',
  'ashes',
  'tide',
  'current',
  'mist',
  'paralysis',
  'overload',
  'static',
  'confusion',
  'hypnosis',
  'premonition',
  'intimidation',
  'highGuard',
  'counterAttack',
  'poison',
  'theft',
  'ambush',
  'armor',
  'plating',
  'heaviness',
  'charm',
  'attract',
  'veil',
  'scales',
  'fury',
  'wrath',
  'mimic',
  'slam',
  'howl',
] as const;
export type StatusId = (typeof STATUS_IDS)[number];

export const STATUSES: Record<StatusId, StatusDef> = {
  photosynthesis: { id: 'photosynthesis', type: 'Grass', roll: 'coin', base: 0.05, strong: 0.1 },
  roots: { id: 'roots', type: 'Grass', roll: 'none', base: 1, strong: 2 },
  vines: { id: 'vines', type: 'Grass', roll: 'die3', base: 7, strong: 6 },
  burn: { id: 'burn', type: 'Fire', roll: 'coin', base: 1, strong: 1 },
  furnace: { id: 'furnace', type: 'Fire', roll: 'none', base: 10, strong: 20 },
  ashes: { id: 'ashes', type: 'Fire', roll: 'die4', base: 1, strong: 1 },
  tide: { id: 'tide', type: 'Water', roll: 'coin', base: 2, strong: 4 },
  current: { id: 'current', type: 'Water', roll: 'none', base: 1, strong: 2 },
  mist: { id: 'mist', type: 'Water', roll: 'die3', base: 1, strong: 1 },
  paralysis: { id: 'paralysis', type: 'Lightning', roll: 'coin', base: 1, strong: 2 },
  overload: { id: 'overload', type: 'Lightning', roll: 'die3', base: 1, strong: 1 },
  static: { id: 'static', type: 'Lightning', roll: 'coin', base: 1, strong: 1 },
  confusion: { id: 'confusion', type: 'Psychic', roll: 'coin', base: 0, strong: 1 },
  hypnosis: { id: 'hypnosis', type: 'Psychic', roll: 'none', base: 2, strong: 4 },
  premonition: { id: 'premonition', type: 'Psychic', roll: 'none', base: 2, strong: 4 },
  intimidation: { id: 'intimidation', type: 'Fighting', roll: 'coin', base: 2, strong: 4 },
  highGuard: { id: 'highGuard', type: 'Fighting', roll: 'die4', base: 4, strong: 3 },
  counterAttack: { id: 'counterAttack', type: 'Fighting', roll: 'coin', base: 0.2, strong: 0.4 },
  poison: { id: 'poison', type: 'Darkness', roll: 'none', base: 0.1, strong: 0.2 },
  theft: { id: 'theft', type: 'Darkness', roll: 'coin', base: 2, strong: 4 },
  ambush: { id: 'ambush', type: 'Darkness', roll: 'die3', base: 1, strong: 2 },
  armor: { id: 'armor', type: 'Metal', roll: 'none', base: 0.05, strong: 0.1 },
  plating: { id: 'plating', type: 'Metal', roll: 'coin', base: 2, strong: 3 },
  heaviness: { id: 'heaviness', type: 'Metal', roll: 'die4', base: 0.5, strong: 0.25 },
  charm: { id: 'charm', type: 'Fairy', roll: 'coin', base: 1, strong: 1 },
  attract: { id: 'attract', type: 'Fairy', roll: 'none', base: 1, strong: 2 },
  veil: { id: 'veil', type: 'Fairy', roll: 'die3', base: 1, strong: 2 },
  scales: { id: 'scales', type: 'Dragon', roll: 'coin', base: 1, strong: 1 },
  fury: { id: 'fury', type: 'Dragon', roll: 'die3', base: 30, strong: 50 },
  wrath: { id: 'wrath', type: 'Dragon', roll: 'coin', base: 1, strong: 2 },
  mimic: { id: 'mimic', type: 'Colorless', roll: 'none', base: 1, strong: 1 },
  slam: { id: 'slam', type: 'Colorless', roll: 'coin', base: 0.15, strong: 0.3 },
  howl: { id: 'howl', type: 'Colorless', roll: 'die3', base: 1, strong: 2 },
};

export function statusesOfType(type: PokemonType): StatusId[] {
  return STATUS_IDS.filter((id) => STATUSES[id].type === type);
}
