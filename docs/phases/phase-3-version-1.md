# Phase 3 · Version 1.0 publique

**Statut** : démarre quand la [phase 2](phase-2-tranche-verticale.md) a franchi sa porte.
**But** : le jeu complet, publié gratuitement sur le web.
**Porte de sortie** : avec l'enjeu de base, le simulateur gagne entre 5 et 15 % des runs.

Référence des règles : [document de game design](../game-design.md).

## Périmètre

**Inclus**

- Run complète : 8 Arènes et le Maître de la Ligue.
- Environ 60 Outils, les Stades, les ACE SPEC, le Centre Pokémon et le booster Premium.
- 3 extensions jouables, une par run.
- Méta-progression : Classeur, decks de départ débloqués à 25 % d'une extension, Outils à débloquer.
- Défi du jour sur graine fixe et graines partageables.
- Hébergement statique gratuit (GitHub Pages, Cloudflare Pages ou Netlify).
- Page de crédits : TCGdex, licence GPL-3.0-or-later, mention de non-affiliation.

**Exclus** : mode infini, enjeux de difficulté, New Game+ (phase 4).

## Tâches

- [ ] Choisir les 2 extensions qui rejoignent Éclipse Cosmique (11 types, images fr et en complètes, lignées nombreuses) et les passer dans le pipeline de données.
- [ ] Revalider les mots-clés de talents sur ces extensions et compléter les corrections.
- [ ] Étendre la run à 8 Arènes et à la Ligue ; courbe de PV complète.
- [ ] Contenu : Outils, Stades, ACE SPEC, énergies spéciales, en fr et en.
- [ ] Classeur et déblocages, sauvegardés localement.
- [ ] Défi du jour et codes de graine.
- [ ] Équilibrage au simulateur jusqu'à la porte, puis vérification à la main.
- [ ] Mise en ligne, nom de domaine éventuel, page de crédits.

## Porte de sortie

- Le simulateur gagne entre 5 et 15 % des runs à l'enjeu de base, avec un bot raisonnable.
- Les 3 extensions sont jouables de bout en bout en français et en anglais.
- Le jeu est en ligne, installable et fonctionne hors-ligne.
