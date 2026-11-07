# Combodex

Roguelite de deckbuilding gratuit, jouable sur navigateur et mobile : « Balatro, mais les mains de poker sont des équipes Pokémon ». On enchaîne des combos de vraies cartes du JCC Pokémon pour battre 8 Arènes, puis la Ligue.

**Statut** : [phase 3](docs/phases/phase-3-version-1.md) développée : 3 extensions, 8 Arènes et la Ligue, Classeur, défi du jour et codes de run, en français et en anglais. Le jeu s'installe en PWA et marche hors-ligne.

## Jouer

Il faut Node 22.18 ou plus.

```sh
npm ci
npm run dev
```

Le prototype en texte reste jouable dans le terminal :

```sh
npm run play -- --seed=42
```

| Commande | Rôle |
| --- | --- |
| `npm run dev` | lancer le jeu en local |
| `npm run build`, `npm run preview` | construire la PWA dans `dist/` et la servir |
| `npm run play` | jouer une run dans le terminal (`--seed`, `--lang=fr` ou `en`, `--set`, `--arenas`) |
| `npm run sim` | simuler des runs avec un bot (`--runs`, `--seed`, `--set`, `--arenas`, `--unlocked`, `--json`) |
| `npm test` | lancer les tests |
| `npm run typecheck`, `npm run lint` | vérifier les types et le style |
| `npm run build:data` | régénérer `data/<extension>.json` depuis TCGdex (`--market` pour relever prix et variantes, `--only=sm1,sm2` pour limiter) |
| `npm run build:icons` | régénérer les icônes de la PWA, avec ImageMagick |

## Documentation

- [Document de game design](docs/game-design.md) : règles, scoring, contenu, décisions.
- Phases de développement :
  1. [Prototype des règles](docs/phases/phase-1-prototype.md)
  2. [Tranche verticale](docs/phases/phase-2-tranche-verticale.md)
  3. [Version 1.0 publique](docs/phases/phase-3-version-1.md)
  4. [Après le lancement](docs/phases/phase-4-apres-lancement.md)

## Données

Les données des cartes et les images viennent de [TCGdex](https://tcgdex.dev), une base open source et multilingue du JCC Pokémon.

## Licence

Code et documentation sous licence [GPL-3.0-or-later](LICENSE).

Combodex est un projet de fan, gratuit et non commercial. Il n'est ni affilié, ni approuvé par Nintendo, Creatures, GAME FREAK ou The Pokémon Company. Pokémon et les illustrations des cartes appartiennent à leurs propriétaires respectifs et ne sont pas couverts par la licence de ce dépôt.
