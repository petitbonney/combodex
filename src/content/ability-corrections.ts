/**
 * Corrections manuelles du classement des talents, par identifiant de carte.
 * Elles l'emportent toujours sur les mots-clés. Pas de texte de carte ici.
 */
import type { AbilityFamily } from '../engine/cards.ts';

export const ABILITY_CORRECTIONS: Readonly<Record<string, AbilityFamily>> = {
  // Échange du Pokémon Actif adverse : le mot-clé « attach » captait ces talents.
  'sm12-1': 'switch',
  'sm12-210': 'switch',
  'sm12-249': 'switch',
  'sm12-57': 'switch',
  // Attache des Énergies en évoluant : l'effet porte sur l'Énergie, pas sur l'évolution.
  'sm12-33': 'energy',
  // Départ sur un lancer de pièce ; « marqueurs » n'est que la condition.
  'sm12-62': 'coinFlip',
  'sm12-240': 'coinFlip',
  // Bloque un adversaire sous État Spécial.
  'sm12-11': 'affliction',
  // Regarde le dessus d'un deck, à l'infinitif : « regardez » ne le reconnaît pas.
  'sm12-72': 'scout',
  // Compte comme deux types.
  'sm12-82': 'versatile',
  'sm12-244': 'versatile',
  // Retire des talents ; « marqueurs » n'est que la condition.
  'sm12-97': 'generic',
  // Réduction de dégâts subis.
  'sm12-110': 'shield',
  'sm12-218': 'shield',
  'sm12-256': 'shield',
  'sm12-122': 'shield',
  'sm12-142': 'shield',
};
