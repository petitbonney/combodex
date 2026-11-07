import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createView,
  renderBooster,
  renderEvent,
  renderFight,
  renderPreview,
  renderShop,
} from '../src/cli/render.ts';
import { en } from '../src/content/i18n/en.ts';
import { fr } from '../src/content/i18n/fr.ts';
import { STATUS_IDS } from '../src/content/statuses.ts';
import { TOOL_IDS } from '../src/content/tools.ts';
import { ABILITY_FAMILIES, type CardSet, indexCards, POKEMON_TYPES } from '../src/engine/cards.ts';
import { COMBO_IDS } from '../src/engine/combos.ts';
import { previewHand } from '../src/engine/fight.ts';
import { applyAction, createRun } from '../src/engine/run.ts';
import { fightRun, fillers, indexOf, opponent } from './helpers.ts';

const set: CardSet = JSON.parse(readFileSync('data/sm12.json', 'utf8'));
const index = indexCards(set);

/** Chemins vers toutes les valeurs d'un arbre, pour comparer deux traductions. */
function paths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => paths(child, `${prefix}.${key}`));
}

describe('traductions', () => {
  it('fr et en ont exactement les mêmes clés', () => {
    expect(paths(en).sort()).toEqual(paths(fr).sort());
  });

  it('couvrent chaque type, Outil, statut, famille et combinaison', () => {
    for (const messages of [fr, en]) {
      for (const type of POKEMON_TYPES) {
        expect(messages.types[type]).toBeTruthy();
        expect(messages.permanents[type]).toBeTruthy();
      }
      for (const id of TOOL_IDS) expect(messages.tools[id].effect).toBeTruthy();
      for (const id of STATUS_IDS) expect(messages.statuses[id].strong).toBeTruthy();
      for (const id of ABILITY_FAMILIES) expect(messages.families[id].effect).toBeTruthy();
      for (const id of COMBO_IDS) expect(messages.combos[id]).toBeTruthy();
    }
  });
});

describe('rendu en texte', () => {
  const view = createView('fr', index);

  it('affiche la main, le Tour et le statut annoncé', () => {
    const base = createRun(index, { seed: 6 });
    const arenas = base.arenas.map((arena) => ({ ...arena, form: 'statuses' as const }));
    const { state } = applyAction(
      { ...base, arenas, stageIndex: 2 },
      { type: 'startFight' },
      index,
    );
    const text = renderFight(view, state, state.fight as never).join('\n');
    expect(text).toContain('Tour 1/4');
    expect(text).toContain('Annoncé au prochain Tour');
    expect(text).toContain('Main :');
  });

  it('masque les cartes face cachée', () => {
    const deck = fillers(10);
    const local = createView('fr', indexOf(deck));
    const state = fightRun({ deck, fight: { faceDownUids: [0] } });
    const text = renderFight(local, state, state.fight as never).join('\n');
    expect(text).toContain('???');
    expect(text).not.toContain(deck[0]?.name.fr as string);
  });

  it("la Brume masque l'aperçu", () => {
    const deck = fillers(10);
    const local = indexOf(deck);
    const state = fightRun({
      deck,
      fight: {
        activeStatus: { id: 'mist', strong: false, sourceId: 'mist' },
        opponent: opponent(),
      },
    });
    const preview = previewHand(state, local, [0]);
    const text = renderPreview(createView('fr', local), state.fight as never, [0], preview);
    expect(text).toBe(fr.ui.previewHidden);
  });

  it("une carte cachée masque l'aperçu qui la contient", () => {
    const deck = fillers(10);
    const local = indexOf(deck);
    const state = fightRun({ deck, fight: { faceDownUids: [0] } });
    const localView = createView('fr', local);
    const hidden = renderPreview(
      localView,
      state.fight as never,
      [0],
      previewHand(state, local, [0]),
    );
    expect(hidden).toBe(fr.ui.previewHidden);
    const shown = renderPreview(
      localView,
      state.fight as never,
      [1],
      previewHand(state, local, [1]),
    );
    expect(shown).toContain('Carte seule');
  });

  it('la Brume renforcée masque les dégâts des cartes', () => {
    const deck = fillers(10);
    const local = createView('fr', indexOf(deck));
    const state = fightRun({
      deck,
      fight: { activeStatus: { id: 'mist', strong: true, sourceId: 'mist' } },
    });
    const text = renderFight(local, state, state.fight as never).join('\n');
    expect(text).not.toContain('dég.');
  });

  it("détaille le score d'une main", () => {
    const start = applyAction(createRun(index, { seed: 6 }), { type: 'startFight' }, index).state;
    const uid = start.fight?.hand[0] as number;
    const { events, state } = applyAction(start, { type: 'play', uids: [uid] }, index);
    const lines = events.flatMap((event) => renderEvent(view, state, event));
    expect(lines.join('\n')).toMatch(/ × /);
  });

  it('affiche la boutique', () => {
    const state = createRun(index, { seed: 6 });
    const shop = {
      slots: [{ kind: 'tool' as const, toolId: 'colossus' as const, type: null, price: 5 }, null],
      boosters: [{ kind: 'energy' as const, price: 4 }, null],
      consumable: null,
      rerollCost: 5,
    };
    const text = renderShop(view, { ...state, money: 7 }, shop).join('\n');
    expect(text).toContain('Colosse (Peu commune)');
    expect(text).toContain('(vendu)');
    expect(text).toContain('Booster Énergie');
  });

  it('liste les Outils d’un booster Dresseur et nomme les quatre boosters', () => {
    const tools = [{ toolId: 'palette' as const, type: null, price: 5 }];
    const booster = {
      kind: 'trainer' as const,
      cards: [],
      energies: [],
      tools,
      keeps: 1,
      free: false,
    };
    expect(renderBooster(view, booster).join('\n')).toContain('Palette');
    const shop = {
      slots: [],
      boosters: [
        { kind: 'trainer' as const, price: 6 },
        { kind: 'premium' as const, price: 8 },
      ],
      consumable: null,
      rerollCost: 5,
    };
    const text = renderShop(view, createRun(index, { seed: 6 }), shop).join('\n');
    expect(text).toContain('Booster Dresseur');
    expect(text).toContain('Booster Premium');
  });
});

describe('interface texte de bout en bout', () => {
  const play = (input: string, ...args: string[]) =>
    execFileSync('node', ['src/cli/main.ts', '--seed=42', ...args], {
      input,
      encoding: 'utf8',
    });

  it("joue une main et rejoue à l'identique avec la graine", () => {
    const script = '\nj 1 2\nq\n';
    const output = play(script);
    expect(output).toContain('COMBODEX');
    expect(output).toContain('dégâts infligés');
    expect(play(script)).toBe(output);
  });

  it('répond en anglais', () => {
    expect(play('\nq\n', '--lang=en')).toContain('Turn 1/4');
  });

  it("refuse une commande inconnue sans s'arrêter", () => {
    expect(play('\nz 1\nq\n')).toContain('Commande non comprise.');
  });
});
