# Phase 2 · Tranche verticale

**Statut** : développement terminé ; il reste à héberger le jeu et à mener la session de test avec 10 personnes. La porte de la [phase 1](phase-1-prototype.md) est franchie.
**But** : une expérience complète et belle sur téléphone, sur un périmètre réduit : 3 Arènes, l'écran de combat, la boutique et l'ouverture de boosters.
**Porte de sortie** : 10 testeurs finissent une run sur téléphone.

Référence des règles : [document de game design](../game-design.md), en particulier la section UX mobile et web.

## Périmètre

**Inclus**

- Écran de combat en portrait (360 px de large, sans défilement vertical) et en paysage sur desktop.
- Animations du scoring : chaque carte puis chaque Outil s'allume avec son bonus ; vitesse réglable et bouton pour passer.
- Annonce du statut du Tour suivant et animation du jet de pièce ou de dé.
- Boutique, ouverture de booster carte par carte, revente d'Outils.
- Visuels TCGdex en `low.webp`, zoom en `high.webp` par appui long ; effet holo et reverse en CSS.
- 3 Arènes complètes et environ 30 Outils.
- Interface en français et en anglais.
- PWA installable, hors-ligne pour l'application ; cache des images déjà vues.
- Sauvegarde locale en IndexedDB après chaque combat.

**Exclus** : Classeur, enjeux, New Game+, ACE SPEC, mode infini, Ligue.

## Décisions de début de phase

- **Framework d'interface** : Svelte 5.
- **Outil de build** : Vite, avec `vite-plugin-pwa` pour le service worker.
- **Gestion des images** : appel direct à `assets.tcgdex.net`. Le service worker garde les images déjà vues (700 au plus, 90 jours). Combodex ne rediffuse aucun visuel ; en contrepartie, une carte jamais vue s'affiche hors-ligne avec une face de repli (nom, type, PV). Un visuel absent dans une langue, comme le français de la carte 72, se replie sur l'autre langue.
- **Crédits** : mention « non affilié à The Pokémon Company » sur l'accueil et dans la fiche À propos, avec le crédit TCGdex et la licence.
- **Outils** : 7 Outils ajoutés sur les archétypes existants pour atteindre 30 offres. Ils sont décrits dans le [document de game design](../game-design.md#outils-et-stades) et restent à valider par le jeu.
- **Boutique** : les boosters Dresseur et Premium rejoignent le moteur. Le consommable, les Stades et le Centre Pokémon restent pour la phase 3.

## Architecture

```text
src/ui/
├── logic/       # sans DOM ni Svelte : session, timeline, sauvegarde, ordre de la main
├── actions/     # gestes : appui long et glisser pour réordonner
├── components/  # carte, rangée d'Outils, éventail, fiches, surcouches d'animation
├── screens/     # accueil, parcours, combat, boutique, booster, fin de run
└── styles/      # jetons de couleur et styles de base
```

- **Pas de règle dans l'interface** : une action est légale si `applyAction` l'accepte. `Session.refusal` essaie l'action sur une copie et rend la raison d'un refus, dont le texte est dans les fichiers de traduction.
- **Animations** : `buildTimeline` traduit les événements du moteur en temps d'animation. Les totaux viennent de `ScoreResult.running`, calculé par le moteur à chaque étape.
- **Reprise** : l'état est sauvegardé avant de jouer les animations. L'état rendu au moteur ne doit jamais être un proxy Svelte, sinon `structuredClone` échoue : `$state.raw` pour tout `RunState`.

## Tâches

- [x] Brancher le moteur de la phase 1 sur l'interface via ses événements, sans dupliquer de règles.
- [x] Écran de combat : Champion, compteur Dégâts × Multi, rangée d'Outils, zone de jeu, main en éventail, boutons.
- [x] Gestes : toucher, glisser pour réordonner, appui long ; raccourcis clavier sur desktop.
- [x] Animations du scoring et du jet de statut, réglables.
- [x] Boutique et ouverture de boosters animée.
- [x] Chargement des images avec préchargement de la main uniquement.
- [x] Fichiers de traduction fr et en pour toute l'interface ; sélecteur de langue.
- [x] PWA : manifeste, service worker, icônes.
- [x] Sauvegarde et reprise d'une run.
- [x] Accessibilité : icône par type en plus de la couleur, contrastes, tailles de texte.
- [ ] Session de test avec 10 personnes et recueil des retours.

## Vérifications

Navigateur intégré et navigateur desktop, sans téléphone réel ; les gestes tactiles restent donc à confirmer sur appareil. Le poste de développement ne permet pas d'ouvrir le serveur local au téléphone (`--host`) : ce test passe par un hébergement.

| Vérification | Résultat |
| --- | --- |
| Écran de combat à 360 × 640 et 360 × 560, texte agrandi compris | tient sans défilement |
| Paysage à 1280 × 760 et 740 × 360 | tient sans défilement |
| Bot jouant 3 runs à travers l'interface | sans action refusée ni erreur console |
| Rechargement de la page en cours de run | la run reprend au même point |
| Build de production, serveur coupé | le jeu s'ouvre, reprend la run et affiche les images déjà vues |
| Contrastes des paires de couleurs | 6,8:1 au minimum |

## Bilan de l'équilibrage

Simulateur, bot glouton, 1 000 runs, graines 1 à 1 000, avec les 7 Outils et les 4 boosters. Le bot n'exploite pas les nouveaux Outils à dessein.

| Mesure | Phase 1 | Phase 2 |
| --- | --- | --- |
| Runs gagnées sur 3 Arènes | 60 % | 63 % |
| Runs gagnées sur 8 Arènes, hors Ligue | 5 % | 6 % |
| Meilleure main médiane d'une run | 8 960 | 9 680 |
| Meilleure main de toutes | 107 640 | 138 240 |

Aucun PV n'a changé.

## Porte de sortie

- 10 testeurs finissent une run complète de 3 Arènes sur leur téléphone.
- Pas de blocage bloquant ni de perte de sauvegarde pendant les tests.
- Les retours sont triés en tâches pour la phase 3.
