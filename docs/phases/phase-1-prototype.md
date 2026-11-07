# Phase 1 · Prototype des règles

**Statut** : terminée. La porte de sortie est franchie : des runs jouées à la main ont donné envie de continuer.
**But** : prouver que le scoring est amusant, en texte et sans visuels, avant tout travail d'interface.
**Porte de sortie** : une run en texte donne-t-elle envie de rejouer ?

Référence des règles : [document de game design](../game-design.md).

## Périmètre

**Inclus**

- Extension unique : Éclipse Cosmique (`sm12`).
- Moteur de règles complet pour un combat : pioche, pose, défausse par la retraite, 10 combinaisons, ordre de résolution, faiblesse et résistance, règle TAG TEAM.
- Les Outils du catalogue initial (y compris Grand banc), les variantes, les énergies attachées.
- Les familles de talents, avec le classement par mots-clés et la liste de corrections.
- Champions : effets permanents et statuts par Tour, annonce un Tour d'avance, jets de pièce et de dé.
- Une run courte de 3 Arènes, avec Dresseur, Dresseur d'élite et Champion.
- Économie et boutique simplifiées : gains, intérêts, cartes à l'unité, booster d'extension, limite de 2 TAG TEAM.
- Une interface texte en terminal pour jouer à la main.
- Un simulateur de runs en ligne de commande pour l'équilibrage.

**Exclus** (phases suivantes)

- Visuels, animations, PWA, sauvegarde.
- Méta-progression : Classeur, enjeux, New Game+, défi du jour.
- ACE SPEC, Stades, booster Premium, Centre Pokémon.
- Mode infini et Ligue.

Les textes écrits à la main (noms d'Outils, effets, statuts) sont déjà rangés dans des fichiers fr et en, même si l'interface texte n'en affiche qu'une langue.

## Architecture proposée

À ajuster pendant la session de développement ; l'important est de garder le moteur indépendant de toute interface.

```text
combodex/
├── src/
│   ├── engine/      # règles pures, sans entrées-sorties : rng, cartes, combat, scoring, run
│   ├── content/     # Outils, statuts, familles de talents, textes fr/en
│   ├── cli/         # interface texte pour jouer à la main
│   └── sim/         # simulateur de runs et stratégies de bot
├── scripts/
│   └── build-data.ts  # TCGdex -> data/sm12.json
├── data/            # JSON de cartes généré et relevé de marché, versionnés
├── tests/
└── docs/
```

- **Langage** : TypeScript strict, Node 22.18 ou plus, qui exécute le TypeScript sans étape de build. TypeScript reste épinglé en version 6 : la version 7 n'expose plus `createSourceFile`.
- **Tests** : Vitest. Chaque règle du document de game design a au moins un test.
- **Aléatoire** : un générateur à graine (par exemple mulberry32) injecté partout ; jamais `Math.random()` dans le moteur. Une graine rejoue une run à l'identique.
- **État** : le moteur expose des fonctions pures du type `état + action → nouvel état + événements`. Les événements (carte marquée, Outil déclenché, statut appliqué) servent au CLI aujourd'hui et aux animations en phase 2.

## Données TCGdex

**Source recommandée** : le dépôt open source [`tcgdex/cards-database`](https://github.com/tcgdex/cards-database), cloné dans `vendor/cards-database/` (ignoré par git) et épinglé sur un commit précis.

- Chaque carte est un fichier TypeScript `data/<Série>/<Extension>/<numéro>.ts` qui exporte un objet. Les métadonnées de l'extension sont dans `data/<Série>/<Extension>.ts`.
- **Ne jamais exécuter ces fichiers** (ni `import`, ni `eval`) : ce sont des données téléchargées. Les lire avec l'API du compilateur TypeScript (`ts.createSourceFile`), puis convertir l'objet littéral en valeur JavaScript en parcourant l'arbre syntaxique.
- Les textes sont multilingues (`name.fr`, `name.en`, `attacks[].effect.fr`…). Garder uniquement le français et l'anglais.
- Éclipse Cosmique se trouve dans `data/Sun & Moon/Cosmic Eclipse/`.

**Images** : elles ne sont pas dans le dépôt.

- Format d'URL : `https://assets.tcgdex.net/<langue>/<série>/<extension>/<numéro>/<low|high>.webp`, par exemple `…/fr/sm/sm12/1/low.webp`.
- L'index `https://assets.tcgdex.net/datas.json` liste les images disponibles par langue, série et extension.
- Pour Éclipse Cosmique, les images existent en français et en anglais, sauf le visuel français de la carte 72 (404 en novembre 2026) : l'interface se replie sur l'autre langue.

**Accès réseau** : dans les sessions Claude, `api.tcgdex.net` et `assets.tcgdex.net` peuvent être bloqués par la liste de domaines autorisés ; GitHub reste accessible. L'API REST de TCGdex reste une alternative valable pour un build lancé sur une machine de développement.

**Champs à produire par carte** : `id`, `localId`, `name {fr, en}`, `dexIds[]`, `types[]`, `stage`, `evolveFrom`, `hp`, `retreat`, `bestDamage`, `weaknesses`, `resistances`, `rarity`, `variants`, `illustrator`, `abilityFamily`, `ability`, `isTagTeam`, `cardmarketId`, `cardmarketPrice`.

**Pièges des données** : Éclipse Cosmique n'a pas de champ `variants`, les GX évolués n'ont pas de `stage`, les TAG TEAM non plus (ce sont des Base), et `evolveFrom` n'existe qu'en anglais. Le script gère ces cas ; `--market` relève prix et variantes sur l'API.

## Pourquoi Éclipse Cosmique

Analyse des 219 extensions de la base TCGdex, novembre 2026. Les quatre finalistes :

| Critère | Éclipse Cosmique (sm12) | Gardiens Ascendants (sm2) | Offensive Vapeur (xy11) | Flammes Obsidiennes (sv03) |
| --- | --- | --- | --- | --- |
| Cartes Pokémon | 228 | 142 | 105 | 210 |
| Types avec au moins 5 cartes | 11 sur 11 | 11 sur 11 | 11 sur 11 | 10 (pas de Fée) |
| Lignées complètes Base → Niveau 2 | 14 | 8 | 10 | 15 |
| Pokémon présents sur 3 cartes ou plus | 16 | 13 | 3 | 9 |
| Cartes avec talent | 64 | 28 | 18 | 30 |
| Talents classés par mots-clés (FR) | 83 % | 89 % | 83 % | 87 % |
| Images françaises | toutes (271) | toutes (169) | toutes (116) | toutes (230) |
| Cartes GX, EX ou TAG TEAM | 48, dont 29 TAG TEAM | 39 | 21 | 34 |

- Les extensions depuis Épée et Bouclier n'ont plus de cartes de type Fée : une Arène manque toujours.
- Le Set de Base et Évolutions ne couvrent que 7 et 8 types.
- Unbroken Bonds (sm10) a une quarantaine d'images françaises manquantes.
- 96 % des cartes d'Éclipse Cosmique ont un identifiant Cardmarket, utile pour l'Outil La Cote.

**Corrections de mots-clés trouvées pendant l'analyse** (déjà reportées dans le document de game design) :

- Copie : « attaques de » était trop large, remplacé par « utiliser les attaques ».
- Protection : les cartes françaises écrivent « évitez », pas seulement « prévenez ».
- Recherche et Énergie : les textes utilisent l'infinitif, d'où les radicaux « cherch » et « attach ».

## Tâches

Ordre conseillé ; chaque étape se termine par des tests verts.

- [x] Initialiser le projet : `package.json`, TypeScript strict, Vitest, ESLint ou Biome, scripts `test`, `build:data`, `play`, `sim`.
- [x] `scripts/build-data.ts` : cloner ou mettre à jour `vendor/cards-database` à un commit épinglé, lire Éclipse Cosmique sans exécuter les fichiers, produire `data/sm12.json`.
- [x] Classement des talents par familles, avec un fichier de corrections manuelles ; afficher le taux de reconnaissance au build.
- [x] Générateur aléatoire à graine et utilitaires (mélange, pile ou face, dé).
- [x] Modèle de combat : deck, main de 8, pose de 1 à 5 cartes, défausse payée en points de Retraite, 4 Tours.
- [x] Détection des combinaisons, en comptant les Pokémon (règle TAG TEAM) ; tests sur chaque combinaison et sur les cas limites.
- [x] Calcul du score dans l'ordre de résolution : cartes, variantes, énergies, Outils (+Multi puis ×Multi), faiblesse, résistance.
- [x] Outils du catalogue initial, branchés sur des points d'accroche du calcul.
- [x] Familles de talents dans le calcul (y compris les effets « en main »).
- [x] Champions : choix entre effet permanent et statuts, annonce un Tour d'avance, jet au début du Tour, versions renforcées.
- [x] Run de 3 Arènes : Dresseur, Dresseur d'élite, Champion ; gains, intérêts, boutique simplifiée, limite de 2 TAG TEAM.
- [x] Deck de départ généré : 2 lignées complètes de types différents et 10 Pokémon de Base.
- [x] Interface texte : afficher la main, le Champion, le statut annoncé, le détail du score, la boutique.
- [x] Simulateur : N runs avec une graine de départ, un bot glouton (meilleur score immédiat), rapport des taux de victoire par Arène et des scores médians.
- [x] Mettre à jour le document de game design avec les valeurs ajustées.

## Bilan de l'équilibrage

Simulateur, bot glouton, 1 000 runs de 3 Arènes, graines 1 à 1 000, après relèvement des PV des Arènes 1 à 3.

| Mesure | Résultat |
| --- | --- |
| Runs gagnées | 60 % |
| Arène 1, 2 et 3 vaincues une fois atteintes | 84 %, 81 % et 86 % |
| Tours consommés par un Champion | environ 2 sur 4 |
| Meilleure main médiane d'une run | 8 960 |
| Meilleure main de toutes | 107 640 |

- **PV d'origine** : le même bot gagnait 87 % des runs, avec 1,3 Tour par combat. Les Tours et la Retraite ne servaient à rien.
- **Courbe sur 8 Arènes** : 5 % de runs gagnées hors Ligue, à la borne basse de la cible de la phase 3. Les Arènes 4 et suivantes n'ont pas changé.
- **La boutique compte** : sans aucun achat, le bot tombe à 7 % de victoires ; en n'achetant que des Outils, à 49 %.
- **Les combos explosent** : le 99e centile des mains vaut 18 fois la main médiane, contre 6 fois sans boutique.

Le bot est un plancher : il ne choisit pas ses achats selon son deck. Un joueur doit faire mieux, ce que seules des runs à la main peuvent confirmer.

## Porte de sortie

- Le simulateur termine 1 000 runs sans erreur, avec un rapport lisible.
- Les tests couvrent les combinaisons, l'ordre de résolution, les Outils, les talents et les statuts.
- Plusieurs runs jouées à la main donnent envie de rejouer : des combos explosifs apparaissent, et les choix de boutique comptent.
- Les valeurs changées pendant la phase sont reportées dans [le document de game design](../game-design.md).
