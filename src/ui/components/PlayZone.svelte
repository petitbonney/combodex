<script lang="ts">
import type { CardData, CardInstance } from '../../engine/index.ts';
import { pressable } from '../actions/pressable.ts';
import { formatBonus } from '../logic/format.ts';
import type { Stage } from '../logic/stage.ts';
import { texts } from '../logic/texts.ts';
import { receive, send } from './card-motion.ts';
import GameCard from './GameCard.svelte';

export interface ZoneEntry {
  uid: number;
  card: CardData;
  instance: CardInstance;
  hidden: boolean;
}

interface Props {
  entries: readonly ZoneEntry[];
  stage: Stage;
  maskDamage: boolean;
  locked: boolean;
  onRemove: (uid: number) => void;
  onLongPress: (uid: number) => void;
  onReorder: (from: number, to: number) => void;
}

const { entries, stage, maskDamage, locked, onRemove, onLongPress, onReorder }: Props = $props();

const app = $derived($texts.text.app);
const scoring = $derived(stage.playedUids !== null);
const finished = $derived(stage.score !== null);

const popup = $derived.by(() => {
  const { beat } = stage;
  if (beat?.kind === 'silenced') return app.silenced;
  if (beat?.kind !== 'card') return null;
  return formatBonus(beat, app.multLabel, $texts.language);
});
</script>

<div
  class="zone"
  class:scoring
  use:pressable={{
    disabled: locked,
    onLongPress: (id) => onLongPress(Number(id)),
    onReorder,
  }}
>
  {#if entries.length === 0}
    <p class="hint">{app.pickCards}</p>
  {/if}
  {#each entries as entry (entry.uid)}
    <button
      class="slot"
      class:lit={stage.litCard === entry.uid}
      class:silenced={stage.silencedCards.includes(entry.uid)}
      class:idle={finished && !stage.scoredCards.includes(entry.uid)}
      type="button"
      data-press-id={entry.uid}
      aria-label={entry.hidden ? app.hiddenCard : entry.card.name[$texts.language]}
      onclick={() => onRemove(entry.uid)}
      in:receive={{ key: entry.uid }}
      out:send={{ key: entry.uid }}
    >
      <GameCard
        card={entry.card}
        variant={entry.instance.variant}
        energies={entry.instance.energies}
            specials={entry.instance.specials}
        hidden={entry.hidden && !scoring}
        {maskDamage}
      />
      {#if stage.litCard === entry.uid && popup}<span class="pop">{popup}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .zone {
    position: relative;
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: calc(var(--zone-w) * 1.376 + 12px);
    padding: 4px;
    border: 1px dashed var(--line);
    border-radius: var(--radius);
    background: rgb(255 255 255 / 3%);
    touch-action: none;
  }

  .zone.scoring {
    border-style: solid;
  }

  .hint {
    color: var(--muted);
    font-size: 0.9rem;
    text-align: center;
  }

  .slot {
    position: relative;
    flex: 0 1 var(--zone-w);
    min-width: 0;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: none;
    transition:
      translate 140ms ease,
      scale 140ms ease,
      opacity 200ms ease;
    -webkit-touch-callout: none;
    user-select: none;
  }

  .slot.lit {
    z-index: 3;
    scale: 1.12;
    filter: drop-shadow(0 0 10px var(--gold));
  }

  .slot.silenced {
    filter: grayscale(1) brightness(0.6);
  }

  .slot.idle {
    opacity: 0.45;
  }

  .slot:global(.dragging) {
    filter: brightness(1.15);
  }

  .pop {
    position: absolute;
    z-index: 5;
    bottom: 100%;
    left: 50%;
    padding: 2px 7px;
    border-radius: 7px;
    background: var(--damage);
    color: var(--damage-ink);
    font-family: var(--font-display);
    font-size: 0.9rem;
    font-weight: 600;
    white-space: nowrap;
    translate: -50% 4px;
    animation: float-up 380ms ease-out;
  }

  @keyframes float-up {
    from {
      translate: -50% 16px;
      opacity: 0;
    }
  }
</style>
