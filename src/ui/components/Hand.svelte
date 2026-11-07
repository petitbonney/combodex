<script lang="ts">
import type { CardData, CardInstance } from '../../engine/index.ts';
import { pressable } from '../actions/pressable.ts';
import { texts } from '../logic/texts.ts';
import { receive, send } from './card-motion.ts';
import GameCard from './GameCard.svelte';

export interface HandEntry {
  uid: number;
  shortcut: number;
  card: CardData;
  instance: CardInstance;
  hidden: boolean;
  paralyzed: boolean;
  forced: boolean;
}

interface Props {
  entries: readonly HandEntry[];
  maskDamage: boolean;
  locked: boolean;
  onToggle: (uid: number) => void;
  onLongPress: (uid: number) => void;
  onReorder: (from: number, to: number) => void;
}

const { entries, maskDamage, locked, onToggle, onLongPress, onReorder }: Props = $props();

const MIN_STEP = 30;
const app = $derived($texts.text.app);
let width = $state(320);
let cardWidth = $state(80);

const count = $derived(entries.length);
const step = $derived(
  count > 1
    ? Math.max(MIN_STEP, Math.min(cardWidth * 0.98, (width - cardWidth) / (count - 1)))
    : 0,
);
const total = $derived(cardWidth + step * Math.max(0, count - 1));
const scrolls = $derived(total > width + 1);
const offset = $derived(scrolls ? 0 : (width - total) / 2);
const mid = $derived((count - 1) / 2);

function label(entry: HandEntry): string {
  if (entry.hidden) return app.hiddenCard;
  const flags = [
    entry.paralyzed ? app.paralyzedCard : '',
    entry.forced ? app.forcedCard : '',
  ].filter(Boolean);
  return [entry.card.name[$texts.language], ...flags].join(', ');
}
</script>

<div
  class="hand"
  class:scrolls
  bind:clientWidth={width}
  use:pressable={{
    disabled: locked,
    onLongPress: (id) => onLongPress(Number(id)),
    onReorder,
  }}
>
  <div class="fan" style:width="{total}px">
    {#each entries as entry, position (entry.uid)}
      <button
        class="slot"
        type="button"
        data-press-id={entry.uid}
        aria-label={label(entry)}
        bind:clientWidth={cardWidth}
        style:left="{offset + position * step}px"
        style:rotate="{(position - mid) * 1.4}deg"
        style:top="{Math.abs(position - mid) ** 2 * 0.45 + 12}px"
        style:z-index={position + 1}
        onclick={() => onToggle(entry.uid)}
        in:receive={{ key: entry.uid }}
        out:send={{ key: entry.uid }}
      >
        <GameCard
          card={entry.card}
          variant={entry.instance.variant}
          energies={entry.instance.energies}
            specials={entry.instance.specials}
          hidden={entry.hidden}
          {maskDamage}
          paralyzed={entry.paralyzed}
          forced={entry.forced}
        />
        {#if entry.shortcut <= 9}<kbd aria-hidden="true">{entry.shortcut}</kbd>{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .hand {
    position: relative;
    flex: none;
    height: calc(var(--card-w) * 1.376 + 30px);
    overflow: clip;
    overflow-clip-margin: 6px;
    touch-action: none;
  }

  .hand.scrolls {
    overflow-x: auto;
    touch-action: pan-x;
    scrollbar-width: none;
  }

  .fan {
    position: relative;
    height: 100%;
    min-width: 100%;
  }

  .slot {
    position: absolute;
    width: var(--card-w);
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: none;
    transform-origin: 50% 100%;
    transition:
      left 180ms ease,
      top 180ms ease,
      rotate 180ms ease,
      translate 140ms ease;
    -webkit-touch-callout: none;
    user-select: none;
  }

  .slot:global(.dragging) {
    filter: brightness(1.15);
    scale: 1.06;
  }

  kbd {
    display: none;
    position: absolute;
    top: -6px;
    left: 50%;
    padding: 0 5px;
    border-radius: 5px;
    background: var(--bg);
    color: var(--muted);
    font-family: var(--font-display);
    font-size: 0.72rem;
    translate: -50% 0;
  }

  @media (hover: hover) and (pointer: fine) {
    .slot:hover {
      translate: 0 -8px;
    }

    kbd {
      display: block;
    }
  }
</style>
