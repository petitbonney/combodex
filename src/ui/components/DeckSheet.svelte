<script lang="ts">
import { type CardInstance, cardOf, type RunState } from '../../engine/index.ts';
import { cardIndex } from '../logic/data.ts';
import { texts } from '../logic/texts.ts';
import CardDetail from './CardDetail.svelte';
import GameCard from './GameCard.svelte';
import Sheet from './Sheet.svelte';

interface Props {
  run: RunState;
  title?: string;
  /** Limite le choix à ces cartes, et ferme sur un toucher. */
  candidates?: readonly CardInstance[];
  onPick?: (instance: CardInstance) => void;
  onClose: () => void;
}

const { run, title, candidates, onPick, onClose }: Props = $props();

const app = $derived($texts.text.app);
const language = $derived($texts.language);

const entries = $derived(
  [...(candidates ?? run.deck)].sort((a, b) =>
    cardOf(cardIndex, a).name[language].localeCompare(cardOf(cardIndex, b).name[language]),
  ),
);

/** En combat, seules les cartes encore en main ou dans le deck restent claires. */
const inPlay = $derived.by(() => {
  const { fight } = run;
  return fight ? new Set([...fight.hand, ...fight.drawPile]) : null;
});

let detail = $state<CardInstance | null>(null);
</script>

{#if detail}
  <CardDetail
    card={cardOf(cardIndex, detail)}
    variant={detail.variant}
    energies={detail.energies}
    onClose={() => (detail = null)}
  />
{:else}
  <Sheet title={title ?? app.deckTitle(run.deck.length)} {onClose}>
    {#if inPlay && !onPick}<p class="hint">{app.deckPlayed}</p>{/if}
    <div class="grid">
      {#each entries as instance (instance.uid)}
        <button
          type="button"
          class:out={!onPick && inPlay && !inPlay.has(instance.uid)}
          aria-label={cardOf(cardIndex, instance).name[language]}
          onclick={() => (onPick ? onPick(instance) : (detail = instance))}
        >
          <GameCard
            card={cardOf(cardIndex, instance)}
            variant={instance.variant}
            energies={instance.energies}
          />
        </button>
      {/each}
    </div>
  </Sheet>
{/if}

<style>
  .hint {
    margin-bottom: 8px;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
    gap: 8px;
  }

  button {
    padding: 0;
    border: 0;
    background: none;
  }

  .out {
    opacity: 0.4;
  }
</style>
