import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ABILITY_CORRECTIONS } from '../src/content/ability-corrections.ts';
import { classifyAbility, normalizeText } from '../src/content/ability-families.ts';
import type { CardSet } from '../src/engine/cards.ts';
import { ABILITY_FAMILIES, indexCards, POKEMON_TYPES } from '../src/engine/cards.ts';
import { completeLines } from '../src/engine/starter-deck.ts';

const set: CardSet = JSON.parse(readFileSync('data/sm12.json', 'utf8'));
const index = indexCards(set);
const byId = (id: string) => index.byId.get(id);

describe('classement des talents', () => {
  it('ignore les majuscules et les accents', () => {
    expect(normalizeText('Évolué À LA Pièce')).toBe('evolue a la piece');
  });

  it.each([
    ['vous pouvez utiliser les attaques de ce Pokémon', 'fr', 'copy'],
    ['this Pokémon can use the attacks of', 'en', 'copy'],
    ['Ce Pokémon est de tous les types', 'fr', 'versatile'],
    ['Faites évoluer ce Pokémon', 'fr', 'evolution'],
    ['ajoutez une carte de votre pile de défausse dans votre main', 'fr', 'recovery'],
    ['put a card from your discard pile into your hand', 'en', 'recovery'],
    ['placez 2 marqueurs de dégâts', 'fr', 'counters'],
    ['Le Pokémon Actif est maintenant Empoisonné', 'fr', 'affliction'],
    ['Évitez tous les dégâts', 'fr', 'shield'],
    ['Prevent all effects', 'en', 'shield'],
    ['soignez 30 dégâts', 'fr', 'heal'],
    ['attachez une carte Énergie', 'fr', 'energy'],
    ['cherchez une carte', 'fr', 'search'],
    ['regardez la main', 'fr', 'scout'],
    ['piochez 2 cartes', 'fr', 'draw'],
    ['échangez ce Pokémon', 'fr', 'switch'],
    ['son Coût de Retraite est nul', 'fr', 'agility'],
    ['inflige 20 dégâts supplémentaires', 'fr', 'power'],
    ['prenez une carte Récompense de plus', 'fr', 'reward'],
    ['défaussez une carte', 'fr', 'discard'],
    ['sur votre Banc', 'fr', 'bench'],
    ['Lancez une pièce', 'fr', 'coinFlip'],
  ] as const)('« %s » (%s) tombe dans %s', (text, language, family) => {
    expect(classifyAbility(text, language)).toBe(family);
  });

  it("ne reconnaît la Récupération qu'avec ses deux mots-clés", () => {
    expect(classifyAbility('dans votre main', 'fr')).toBeNull();
  });

  it('respecte la priorité : Défausse passe après Recherche', () => {
    expect(classifyAbility('défaussez une carte, puis cherchez une carte', 'fr')).toBe('search');
  });

  it('renvoie null sans mot-clé, pour la famille Générique', () => {
    expect(classifyAbility('Ce Pokémon est content', 'fr')).toBeNull();
  });

  it('fait primer les corrections manuelles', () => {
    for (const [id, family] of Object.entries(ABILITY_CORRECTIONS)) {
      expect(byId(id)?.abilityFamily).toBe(family);
    }
  });
});

describe('données Éclipse Cosmique', () => {
  it('garde les Pokémon qui ont au moins une attaque', () => {
    expect(set.cards.length).toBe(226);
    expect(set.cards.find((card) => card.name.en === 'Azurill')).toBeUndefined();
  });

  it('couvre les 11 types', () => {
    const types = new Set(set.cards.flatMap((card) => card.types));
    expect([...types].sort()).toEqual([...POKEMON_TYPES].sort());
  });

  it('produit tous les champs attendus', () => {
    for (const card of set.cards) {
      expect(card.dexIds.length).toBeGreaterThan(0);
      expect(card.name.fr).not.toBe('');
      expect(card.bestDamage).toBeGreaterThan(0);
      expect(card.variants.length).toBeGreaterThan(0);
      expect(card.hp).toBeGreaterThan(0);
      if (card.abilityFamily) expect(ABILITY_FAMILIES).toContain(card.abilityFamily);
    }
  });

  it('reconnaît les 29 TAG TEAM, qui réunissent 2 ou 3 Pokémon', () => {
    const tagTeams = set.cards.filter((card) => card.isTagTeam);
    expect(tagTeams.length).toBe(29);
    for (const card of tagTeams) {
      expect(card.dexIds.length).toBeGreaterThanOrEqual(2);
      expect(card.stage).toBe('Basic');
    }
  });

  it('déduit le stade des GX évolués', () => {
    const gx = set.cards.find((card) => card.name.en === 'Vileplume GX');
    expect(gx?.stage).toBe('Stage2');
    const silvally = set.cards.find((card) => card.name.en === 'Silvally GX');
    expect(silvally?.stage).toBe('Stage1');
  });

  it('ignore les suffixes de dégâts', () => {
    expect(byId('sm12-1')?.bestDamage).toBe(160);
    const multiplied = set.cards.filter((card) => card.bestDamage % 10 !== 0);
    expect(multiplied).toEqual([]);
  });

  it('propose au moins 10 lignées complètes pour les decks de départ', () => {
    const lines = completeLines(index);
    expect(lines.length).toBeGreaterThanOrEqual(10);
    expect(new Set(lines.map((line) => line.type)).size).toBeGreaterThanOrEqual(2);
  });
});
