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
  // Soleil et Lune. « évolu » n'est que la condition : l'effet vient après.
  'sm1-20': 'discard',
  'sm1-104': 'recovery',
  // Rend la carte à la main ; « attach » n'est que le prix.
  'sm1-44': 'recovery',
  // Retire des talents ; « défauss » n'est que le lieu.
  'sm1-58': 'generic',
  // Déplace des Énergies.
  'sm1-66': 'energy',
  'sm1-141': 'energy',
  'sm1-153': 'energy',
  // Réduction de dégâts subis.
  'sm1-75': 'shield',
  // Révèle la main adverse.
  'sm1-110': 'scout',
  'sm1-145': 'scout',
  'sm1-157': 'scout',
  // Gardiens Ascendants. « évolu » n'est que la condition : l'effet vient après.
  'sm2-16': 'affliction',
  'sm2-74': 'switch',
  'sm2-138': 'switch',
  'sm2-156': 'switch',
  'sm2-102': 'heal',
  'sm2-113': 'draw',
  // Réduction de dégâts subis.
  'sm2-9': 'shield',
  'sm2-98': 'shield',
  // Relance les pièces d'une attaque.
  'sm2-10': 'coinFlip',
  // Déplace un marqueur de dégâts.
  'sm2-13': 'counters',
  // Échange la carte ; « marqueurs » n'est que la condition.
  'sm2-37': 'switch',
  // Protège le Banc ; « marqueurs » n'est que la conséquence.
  'sm2-64': 'shield',
  // Limite le Banc adverse ; « défauss » n'est que la conséquence.
  'sm2-66': 'bench',
  // Protège des États Spéciaux ; « attach » n'est que la condition.
  'sm2-93': 'shield',
};
