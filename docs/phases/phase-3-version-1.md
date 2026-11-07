# Phase 3 · Version 1.0 publique

**Statut** : développement terminé. Démarrée à la demande, avant la session de test de la [phase 2](phase-2-tranche-verticale.md), que l'hébergement rend possible. Le jeu est en ligne sur [petitbonney.github.io/combodex](https://petitbonney.github.io/combodex/). Il reste la vérification à la main et le nom de domaine éventuel.
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

**Exclus** : mode infini, enjeux de difficulté, New Game+, classement partagé du défi du jour (phase 4).

## Décisions de début de phase

- **Extensions** : Soleil et Lune (`sm1`) et Gardiens Ascendants (`sm2`) rejoignent Éclipse Cosmique. Les deux ont 11 types et toutes les images de leurs cartes jouables en français et en anglais. Harmonie des Esprits (`sm11`), plus riche, n'a pas 68 de ses images en français.
- **Déblocages** : une seule extension ouverte au départ, les suivantes par des objectifs explicites ou mystères, et un menu pour parcourir extensions et cartes. Les 25 % d'une extension ouvrent le deck custom, où le joueur choisit ses lignées.
- **Contenu** : conçu pendant la phase sur les archétypes existants, reporté dans le [document de game design](../game-design.md) et à valider par le jeu.
- **Hébergement** : GitHub Pages, par le workflow `.github/workflows/deploy.yml`.

## Tâches

- [x] Choisir les 2 extensions qui rejoignent Éclipse Cosmique (11 types, images fr et en complètes, lignées nombreuses) et les passer dans le pipeline de données.
- [x] Revalider les mots-clés de talents sur ces extensions et compléter les corrections.
- [x] Étendre la run à 8 Arènes et à la Ligue ; courbe de PV complète.
- [x] Contenu : Outils, Stades, ACE SPEC, énergies spéciales, en fr et en.
- [x] Classeur et déblocages, sauvegardés localement.
- [x] Défi du jour et codes de graine.
- [x] Équilibrage au simulateur jusqu'à la porte.
- [ ] Vérification de l'équilibrage à la main.
- [x] Mise en ligne et page de crédits.
- [ ] Nom de domaine éventuel.

## Vérifications

Navigateur intégré, sans téléphone réel. Le bot joue à travers la vraie session de l'interface ; il ne remplace pas une partie jouée à la main.

| Vérification | Résultat |
| --- | --- |
| Bot jouant une run complète à travers l'interface | 154 actions jusqu'à la victoire contre la Ligue, sans action refusée ni erreur console |
| Boutique à la souris : consommable, Centre Pokémon, ACE SPEC avec cible, Stade qui en remplace un autre | état du moteur conforme après chaque achat |
| Combat de la Ligue, main de 10 cartes et 6 emplacements d'Outils à 360 × 640 | tient sans défilement |
| Boutique en paysage à 1280 × 760 | tient sans défilement |
| Parcours d'une extension, objectifs, deck custom, défi du jour, crédits | affichés en français ; accueil et défi du jour relus en anglais |
| Rechargement de la page | la progression et la run sont conservées |
| Site en ligne | le jeu s'ouvre, une run démarre, les 9 visuels du combat se chargent ; service worker actif, 13 fichiers en cache |

## Bilan de l'équilibrage

Simulateur, 1 000 runs par extension, graines 1 à 1 000, run complète jusqu'à la Ligue, avec les PV du [document de game design](../game-design.md#champions-darène-et-difficulté).

Le bot glouton de la phase 2 ne gagnait que 0,5 % des runs : il achetait au hasard. Le nouveau bot estime chaque Outil sur des mains tirées de son deck, affine son deck au Centre Pokémon et utilise ses consommables. Avec les PV de la phase 2, il gagnait 32 à 39 % des runs ; les Arènes 3 à 8 et la Ligue ont donc été relevées.

| Mesure | Éclipse Cosmique | Soleil et Lune | Gardiens Ascendants |
| --- | --- | --- | --- |
| Runs gagnées, Outils à débloquer absents | 12,6 % | 7,5 % | 8,5 % |
| Runs gagnées, tous les Outils | 10,0 % | 6,3 % | 7,9 % |
| Runs qui atteignent la Ligue | 27 % | 20 % | 20 % |
| Ligue vaincue une fois atteinte | 46 % | 39 % | 43 % |
| Meilleure main médiane d'une run | 109 275 | 70 860 | 78 855 |
| Meilleure main de toutes | 7 264 160 | 3 006 720 | 4 079 003 |

- Les Outils à débloquer ne changent presque rien aux résultats : le bot ne construit pas son deck autour d'eux, et l'écart reste dans le bruit de 1 000 runs.
- Le bot reste un repère, pas un joueur : il s'appuie sur des estimations que la Brume et les statuts ne gênent pas.

## Porte de sortie

- Le simulateur gagne entre 5 et 15 % des runs à l'enjeu de base, avec un bot raisonnable.
- Les 3 extensions sont jouables de bout en bout en français et en anglais.
- Le jeu est en ligne, installable et fonctionne hors-ligne.
