# Phase 2 · Tranche verticale

**Statut** : démarre quand la [phase 1](phase-1-prototype.md) a franchi sa porte.
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

## Décisions à prendre en début de phase

- Framework d'interface : Svelte ou React.
- Outil de build : Vite est le choix naturel pour les deux.
- Gestion des images : appel direct à `assets.tcgdex.net` ou copie des images au build (impact sur le risque juridique et sur le hors-ligne).
- Crédits et mention « non affilié à The Pokémon Company » dans l'application.

## Tâches

- [ ] Brancher le moteur de la phase 1 sur l'interface via ses événements, sans dupliquer de règles.
- [ ] Écran de combat : Champion, compteur Dégâts × Multi, rangée d'Outils, zone de jeu, main en éventail, boutons.
- [ ] Gestes : toucher, glisser pour réordonner, appui long ; raccourcis clavier sur desktop.
- [ ] Animations du scoring et du jet de statut, réglables.
- [ ] Boutique et ouverture de boosters animée.
- [ ] Chargement des images avec préchargement de la main uniquement.
- [ ] Fichiers de traduction fr et en pour toute l'interface ; sélecteur de langue.
- [ ] PWA : manifeste, service worker, icônes.
- [ ] Sauvegarde et reprise d'une run.
- [ ] Accessibilité : icône par type en plus de la couleur, contrastes, tailles de texte.
- [ ] Session de test avec 10 personnes et recueil des retours.

## Porte de sortie

- 10 testeurs finissent une run complète de 3 Arènes sur leur téléphone.
- Pas de blocage bloquant ni de perte de sauvegarde pendant les tests.
- Les retours sont triés en tâches pour la phase 3.
