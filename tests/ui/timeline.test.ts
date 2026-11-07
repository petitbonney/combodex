import { describe, expect, it } from 'vitest';
import { messagesFor } from '../../src/content/i18n/index.ts';
import { type Action, applyAction, type RunState } from '../../src/engine/index.ts';
import { advanceStage, EMPTY_STAGE } from '../../src/ui/logic/stage.ts';
import { buildTimeline } from '../../src/ui/logic/timeline.ts';
import { card, fightRun, fillers, indexOf, opponent, tool } from '../helpers.ts';

const boss = card({ id: 'boss' });

function timelineOf(state: RunState, action: Action, cards: Parameters<typeof indexOf>[0]) {
  const index = indexOf(cards);
  const { state: after, events } = applyAction(state, action, index);
  return buildTimeline({
    before: state,
    after,
    action,
    events,
    index,
    language: 'fr',
    text: messagesFor('fr'),
  });
}

describe('timeline du scoring', () => {
  const deck = fillers(12, { types: ['Fire'], bestDamage: 40, dexIds: [940] });
  const cards = [...deck, boss];
  const fight = () =>
    fightRun({
      deck,
      tools: [tool(50, 'campfire', 'Fire')],
      fight: { opponent: opponent({ hp: 100000, maxHp: 100000 }) },
    });

  it('allume chaque carte puis chaque Outil, avant le total et le coup', () => {
    const { before } = timelineOf(fight(), { type: 'play', uids: [0, 1] }, cards);
    expect(before.slice(0, 7).map((beat) => beat.kind)).toEqual([
      'reveal',
      'combo',
      'card',
      'card',
      'tool',
      'total',
      'hit',
    ]);
  });

  it('finit le compteur sur les valeurs du moteur', () => {
    const { before } = timelineOf(fight(), { type: 'play', uids: [0, 1] }, cards);
    const stage = before.slice(0, 6).reduce(advanceStage, EMPTY_STAGE);
    expect(stage.counter).toEqual({ damage: 20 + 40 + 40, mult: 2 + 8 });
    expect(stage.score).toBe(1000);
    expect(stage.scoredCards).toEqual([0, 1]);
  });

  it('fait baisser les PV au moment du coup', () => {
    const { before } = timelineOf(fight(), { type: 'play', uids: [0, 1] }, cards);
    const stage = before.slice(0, 7).reduce(advanceStage, EMPTY_STAGE);
    expect(stage.hp).toBe(99000);
  });

  it('montre les ×Multi des cartes à part, avec le Multi du moteur', () => {
    const state = fight();
    (state.deck[0] as { variant: string }).variant = 'firstEdition';
    const { before } = timelineOf(state, { type: 'play', uids: [0] }, cards);
    const modifier = before.find((beat) => beat.kind === 'modifier');
    expect(modifier).toMatchObject({ label: 'Cartes : ×1.5 Multi' });
  });
});

describe('timeline des statuts', () => {
  const deck = fillers(14, { bestDamage: 40 });
  const cards = [...deck, boss];

  it('lance le dé ou la pièce du statut annoncé, puis annonce le suivant', () => {
    const state = fightRun({
      deck,
      fight: {
        announcedStatus: 'photosynthesis',
        opponent: opponent({ hp: 90000, maxHp: 100000, form: 'statuses' }),
      },
    });
    const { before, after } = timelineOf(state, { type: 'play', uids: [0] }, cards);
    const kinds = before.map((beat) => beat.kind);
    expect(kinds.indexOf('hit')).toBeLessThan(kinds.indexOf('turn'));
    expect(kinds.indexOf('turn')).toBeLessThan(kinds.indexOf('roll'));
    expect(before.find((beat) => beat.kind === 'roll')).toMatchObject({ dice: 'coin' });
    expect(after.at(-1)?.kind).toBe('announce');
  });

  it('applique sans jet un statut qui n’en a pas', () => {
    const state = fightRun({
      deck,
      fight: {
        announcedStatus: 'roots',
        opponent: opponent({ hp: 90000, maxHp: 100000, form: 'statuses' }),
      },
    });
    const { before } = timelineOf(state, { type: 'play', uids: [0] }, cards);
    expect(before.map((beat) => beat.kind)).not.toContain('roll');
    expect(before.find((beat) => beat.kind === 'statusHit')).toMatchObject({ id: 'roots' });
  });
});

describe('fin de combat', () => {
  const deck = fillers(14, { bestDamage: 40 });
  const cards = [...deck, boss];

  it('finit une victoire sur les gains, avant la boutique', () => {
    const state = fightRun({ deck, fight: { opponent: opponent({ hp: 1 }) } });
    const { before } = timelineOf(state, { type: 'play', uids: [0] }, cards);
    expect(before.at(-1)?.kind).toBe('gains');
  });

  it('annonce une Arène vaincue seulement après le Champion', () => {
    const won = (kind: 'trainer' | 'champion') => {
      const state = fightRun({ deck, fight: { opponent: opponent({ hp: 1, kind }) } });
      return timelineOf(state, { type: 'play', uids: [0] }, cards).before.at(-1);
    };
    expect(won('trainer')).toMatchObject({ arenaCleared: null });
    expect(won('champion')).toMatchObject({ arenaCleared: 1 });
  });

  it('finit une défaite sur son annonce', () => {
    const state = fightRun({
      deck,
      fight: { turn: 4, opponent: opponent({ hp: 100000, maxHp: 100000 }) },
    });
    const { before } = timelineOf(state, { type: 'play', uids: [0] }, cards);
    expect(before.at(-1)?.kind).toBe('defeat');
  });
});
