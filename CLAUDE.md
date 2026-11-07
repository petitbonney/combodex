# Combodex · Notes pour Claude

Roguelite de deckbuilding web et mobile inspiré de Balatro, basé sur les vraies cartes du JCC Pokémon (données TCGdex).

## Avant de coder

1. Lire [`docs/game-design.md`](docs/game-design.md) : c'est la source de vérité des règles. Toutes les questions de conception y sont tranchées (section Décisions).
2. Lire le fichier de la phase en cours dans [`docs/phases/`](docs/phases/). Phase actuelle : [phase 1, prototype des règles](docs/phases/phase-1-prototype.md).
3. Une règle absente ou ambiguë dans le document de game design se demande à l'utilisateur ; ne pas l'inventer en silence.

## Conventions

- Documentation et échanges en français ; identifiants de code en anglais.
- TypeScript strict. Le moteur de règles (`src/engine/`) reste pur : pas d'entrées-sorties, pas de `Math.random()`, un générateur à graine injecté.
- Tout texte affiché au joueur passe par les fichiers de traduction fr et en, jamais en dur.
- Chaque règle implémentée a son test. Les valeurs d'équilibrage changées sont reportées dans `docs/game-design.md`.
- Cocher les tâches terminées dans le fichier de la phase.

## Commandes

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build:data`, `npm run play`, `npm run sim`. Node exécute le TypeScript directement : les imports gardent leur extension `.ts`, et seule la syntaxe effaçable est permise.

## Données TCGdex

- Source : dépôt [`tcgdex/cards-database`](https://github.com/tcgdex/cards-database), cloné dans `vendor/` (ignoré par git) et épinglé sur un commit.
- Ne jamais exécuter les fichiers `.ts` de ce dépôt : les lire avec l'API du compilateur TypeScript et convertir l'arbre syntaxique en valeurs. TypeScript reste épinglé en version 6 : la version 7 n'expose plus cette API.
- `api.tcgdex.net` et `assets.tcgdex.net` peuvent être inaccessibles depuis une session Claude ; GitHub l'est.
- Extension du prototype : Éclipse Cosmique (`sm12`, `data/Sun & Moon/Cosmic Eclipse/`).
- Ne pas recopier les textes des cartes (attaques, talents) dans la documentation ; les garder dans les données générées.

## Licence

GPL-3.0-or-later. Projet de fan non commercial, non affilié à The Pokémon Company.
