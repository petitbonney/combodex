<script lang="ts">
import type { ComboId } from '../../engine/index.ts';
import { formatNumber } from '../logic/format.ts';
import { texts } from '../logic/texts.ts';

interface Props {
  combo: ComboId | null;
  damage: number | null;
  mult: number | null;
  /** Score final de l'animation, ou estimation avant de jouer. */
  score: number | null;
  estimated: boolean;
  masked: boolean;
  /** Détail affiché à la place du nom, par exemple un malus. */
  note?: string | null;
}

const { combo, damage, mult, score, estimated, masked, note = null }: Props = $props();

const text = $derived($texts.text);
const app = $derived(text.app);
const language = $derived($texts.language);

const show = (value: number | null) =>
  masked ? '?' : value === null ? '–' : formatNumber(value, language);

const headline = $derived.by(() => {
  if (note) return note;
  if (masked) return app.estimateHidden;
  return combo ? text.combos[combo] : ' ';
});

const total = $derived.by(() => {
  if (masked || score === null) return ' ';
  const value = formatNumber(score, language);
  return estimated ? app.estimate(value) : value;
});
</script>

<section class="counter" aria-label={app.scoreLine(app.damageLabel, app.multLabel)}>
  <div class="head">
    <span class="combo">{headline}</span>
    <span class="total" class:final={!estimated} aria-live="polite">{total}</span>
  </div>
  <div class="values">
    {#key damage}
      <span class="chip damage"><small>{app.damageLabel}</small>{show(damage)}</span>
    {/key}
    <span class="times" aria-hidden="true">×</span>
    {#key mult}
      <span class="chip mult"><small>{app.multLabel}</small>{show(mult)}</span>
    {/key}
  </div>
</section>

<style>
  .counter {
    display: grid;
    flex: none;
    gap: 3px;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    min-height: 1.4rem;
    font-family: var(--font-display);
    font-weight: 500;
  }

  .combo {
    min-width: 0;
    overflow: hidden;
    color: var(--gold);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .total {
    flex: none;
    color: var(--muted);
  }

  .total.final {
    color: var(--text);
    font-size: 1.3rem;
    font-weight: 600;
  }

  .values {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 6px;
    align-items: center;
  }

  .chip {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
    min-width: 0;
    padding: 2px 10px;
    border-radius: 10px;
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.25;
    animation: bump 180ms ease-out;
  }

  small {
    font-size: 0.72rem;
    font-weight: 500;
  }

  .damage {
    background: var(--damage);
    color: var(--damage-ink);
  }

  .mult {
    background: var(--mult);
    color: var(--mult-ink);
  }

  .times {
    color: var(--muted);
    font-family: var(--font-display);
    font-size: 1.3rem;
  }

  @keyframes bump {
    from {
      scale: 1.07;
    }
  }
</style>
