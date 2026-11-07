<script lang="ts">
import { type StatusId } from '../../content/statuses.ts';
import { session } from '../logic/game.ts';
import { formatNumber } from '../logic/format.ts';
import { BEAT_MS } from '../logic/timeline.ts';
import { speedFactor } from '../logic/settings.ts';
import { texts } from '../logic/texts.ts';

interface Props {
  strong: boolean;
}

const { strong }: Props = $props();

const beat = $derived($session.stage.beat);
const text = $derived($texts.text);
const app = $derived(text.app);
const language = $derived($texts.language);

function effectOf(id: StatusId): string {
  return strong ? text.statuses[id].strong : text.statuses[id].base;
}

const rollMs = $derived(BEAT_MS.roll / speedFactor());
</script>

<div class="overlay" aria-live="polite">
  {#if beat?.kind === 'turn'}
    <div class="banner big" role="status">{app.turnBanner(beat.turn)}</div>
  {:else if beat?.kind === 'notice'}
    <div class="banner {beat.tone}" role="status">{beat.text}</div>
  {:else if beat?.kind === 'statusHit'}
    <div class="banner bad" role="status">
      <strong>{text.statuses[beat.id].name}</strong>
      <span>{effectOf(beat.id)}</span>
    </div>
  {:else if beat?.kind === 'announce'}
    <div class="banner info" role="status">
      <small>{app.statusComing}</small>
      <strong>{text.statuses[beat.id].name}</strong>
      <span>{effectOf(beat.id)}</span>
    </div>
  {:else if beat?.kind === 'roll'}
    <div class="roll" style:--roll-ms="{rollMs}ms" role="status">
      <strong>{text.statuses[beat.id].name}</strong>
      {#if beat.dice === 'coin'}
        <div class="coin" class:heads={beat.success}>
          <span class="side front">{app.coinHeads}</span>
          <span class="side rear">{app.coinTails}</span>
        </div>
      {:else}
        <div class="die">{beat.rolled}</div>
      {/if}
      <p class="result" class:success={beat.success}>
        {#if beat.dice === 'die' && beat.rolled !== null}{app.rollDie(beat.rolled)} · {/if}
        {beat.success ? app.rollSuccess : app.rollFailure}
      </p>
    </div>
  {:else if beat?.kind === 'defeat'}
    <div class="banner bad big" role="status">{app.defeat}</div>
  {:else if beat?.kind === 'gains'}
    <div class="gains" role="status">
      <h2>{beat.arenaCleared ? app.arenaCleared(beat.arenaCleared) : app.victory}</h2>
      <dl>
        <div><dt>{app.gainVictory}</dt><dd>+{beat.gains.victory} ₽</dd></div>
        {#if beat.gains.unusedTurns > 0}
          <div><dt>{app.gainTurns}</dt><dd>+{beat.gains.unusedTurns} ₽</dd></div>
        {/if}
        {#if beat.gains.interest > 0}
          <div><dt>{app.gainInterest}</dt><dd>+{beat.gains.interest} ₽</dd></div>
        {/if}
        {#if beat.gains.picnic > 0}
          <div><dt>{app.gainPicnic}</dt><dd>+{beat.gains.picnic} ₽</dd></div>
        {/if}
        {#if beat.gains.bonus > 0}
          <div><dt>{app.gainBonus}</dt><dd>+{beat.gains.bonus} ₽</dd></div>
        {/if}
        {#if beat.gains.reward > 0}
          <div><dt>{app.gainReward}</dt><dd>+{beat.gains.reward} ₽</dd></div>
        {/if}
        <div class="total">
          <dt>{app.gainTotal}</dt>
          <dd>+{formatNumber(beat.gains.total, language)} ₽</dd>
        </div>
      </dl>
      <button class="btn primary" type="button" onclick={() => session.skip()}>
        {app.continueLabel}
      </button>
    </div>
  {/if}
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    padding: 16px;
    pointer-events: none;
  }

  .banner,
  .roll,
  .gains {
    pointer-events: auto;
    max-width: 330px;
    padding: 12px 16px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: rgb(12 16 34 / 94%);
    box-shadow: var(--shadow);
    text-align: center;
    animation: pop 180ms ease-out;
  }

  .banner {
    display: grid;
    gap: 2px;
    pointer-events: none;
  }

  .banner strong {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 600;
  }

  .banner small {
    color: var(--muted);
    font-size: 0.82rem;
  }

  .banner.big {
    padding: 14px 30px;
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 600;
  }

  .banner.good {
    border-color: var(--good);
  }

  .banner.bad {
    border-color: var(--bad);
  }

  .banner.info {
    border-color: var(--gold);
  }

  @keyframes pop {
    from {
      scale: 0.86;
      opacity: 0;
    }
  }

  .roll {
    display: grid;
    gap: 10px;
    justify-items: center;
    min-width: 220px;
    perspective: 500px;
  }

  .roll strong {
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 600;
  }

  .coin {
    position: relative;
    width: 84px;
    height: 84px;
    transform-style: preserve-3d;
    animation: spin-tails calc(var(--roll-ms) * 0.62) cubic-bezier(0.25, 0.7, 0.3, 1) both;
  }

  .coin.heads {
    animation-name: spin-heads;
  }

  .side {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border: 4px solid #d99a1c;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #ffe08a, var(--gold));
    color: var(--gold-ink);
    font-family: var(--font-display);
    font-weight: 600;
    backface-visibility: hidden;
  }

  .rear {
    rotate: y 180deg;
    background: radial-gradient(circle at 35% 30%, #dfe6f2, #98a6bd);
    border-color: #6f7d96;
    color: #10131f;
  }

  @keyframes spin-heads {
    from {
      transform: rotateY(0);
    }

    to {
      transform: rotateY(1800deg);
    }
  }

  @keyframes spin-tails {
    from {
      transform: rotateY(0);
    }

    to {
      transform: rotateY(1980deg);
    }
  }

  .die {
    display: grid;
    place-items: center;
    width: 76px;
    height: 76px;
    border-radius: 14px;
    background: var(--text);
    color: var(--type-ink);
    font-family: var(--font-display);
    font-size: 2.2rem;
    font-weight: 600;
    animation: tumble calc(var(--roll-ms) * 0.62) ease-out both;
  }

  @keyframes tumble {
    0% {
      color: transparent;
      rotate: 0deg;
      scale: 0.7;
    }

    85% {
      color: transparent;
      rotate: 720deg;
      scale: 1.05;
    }

    100% {
      rotate: 720deg;
      scale: 1;
    }
  }

  .result {
    color: var(--good);
    font-family: var(--font-display);
    font-weight: 500;
    animation: appear calc(var(--roll-ms) * 0.7) step-end both;
  }

  .result.success {
    color: var(--bad);
  }

  @keyframes appear {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  .gains {
    display: grid;
    gap: 12px;
    width: min(100%, 320px);
  }

  .gains h2 {
    color: var(--gold);
    font-size: 1.6rem;
  }

  dl {
    display: grid;
    gap: 4px;
    margin: 0;
  }

  dl div {
    display: flex;
    justify-content: space-between;
  }

  dd {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 500;
  }

  .total {
    margin-top: 4px;
    padding-top: 6px;
    border-top: 1px solid var(--line);
    color: var(--gold);
    font-weight: 700;
  }
</style>
