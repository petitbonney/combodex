/** Ce que l'écran de combat montre pendant une animation, dérivé temps après temps. */
import type { ComboId } from '../../engine/index.ts';
import type { Beat, Running } from './timeline.ts';

export interface Stage {
  beat: Beat | null;
  /** Ordre réel des cartes pendant le calcul ; `null` hors animation. */
  playedUids: number[] | null;
  litCard: number | null;
  litTool: number | null;
  silencedCards: number[];
  scoredCards: number[];
  combo: ComboId | null;
  counter: Running | null;
  score: number | null;
  /** PV affichés pendant l'animation ; `null` : ceux de l'état. */
  hp: number | null;
}

export const EMPTY_STAGE: Stage = {
  beat: null,
  playedUids: null,
  litCard: null,
  litTool: null,
  silencedCards: [],
  scoredCards: [],
  combo: null,
  counter: null,
  score: null,
  hp: null,
};

export function advanceStage(stage: Stage, beat: Beat): Stage {
  const next: Stage = { ...stage, beat, litCard: null, litTool: null };
  switch (beat.kind) {
    case 'reveal':
      return { ...next, playedUids: beat.playedUids };
    case 'combo':
      return { ...next, combo: beat.combo, counter: beat.running };
    case 'card':
      return {
        ...next,
        litCard: beat.uid,
        scoredCards: [...stage.scoredCards, beat.uid],
        counter: beat.running,
      };
    case 'silenced':
      return {
        ...next,
        litCard: beat.uid,
        silencedCards: [...stage.silencedCards, beat.uid],
        counter: beat.running,
      };
    case 'tool':
      return { ...next, litTool: beat.uid, counter: beat.running };
    case 'modifier':
      return { ...next, counter: beat.running };
    case 'total':
      return {
        ...next,
        counter: { damage: beat.damage, mult: beat.mult },
        score: beat.score + beat.flatDamage,
      };
    case 'hit':
      return { ...next, hp: beat.hp };
    case 'notice':
      return beat.hp === undefined ? next : { ...next, hp: beat.hp };
    case 'turn':
    case 'roll':
    case 'statusHit':
    case 'announce':
    case 'gains':
    case 'defeat':
      return next;
  }
}
