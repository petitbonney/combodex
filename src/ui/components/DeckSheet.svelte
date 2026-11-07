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
  hint?: string;
  /** Limite le choix à ces cartes, et ferme sur un toucher. */
  candidates?: readonly CardInstance[];
  onPick?: (instance: CardInstance) => void;
  /** Choix de plusieurs cartes, validé par un bouton. */
  pickCount?: number;
  onPickMany?: (instances: CardInstance[]) => void;
  onClose: () => void;
}

const { run, title, hint, candidates, onPick, pickCount = 0, onPickMany, onClose }: Props = $props();

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
let chosen = $state<number[]>([]);

const picking = $derived(onPick !== undefined || onPickMany !== undefined);

function tap(instance: CardInstance): void {
  if (onPick) {
    onPick(instance);
    return;
  }
  if (!onPickMany) {
    detail = instance;
    return;
  }
  if (chosen.includes(instance.uid)) chosen = chosen.filter((uid) => uid !== instance.uid);
  else if (chosen.length < pickCount) chosen = [...chosen, instance.uid];
}

function confirm(): void {
  onPickMany?.(run.deck.filter((card) => chosen.includes(card.uid)));
}
</script>

{#if detail}
  <CardDetail
    card={cardOf(cardIndex, detail)}
    variant={detail.variant}
    energies={detail.energies}
    specials={detail.specials}
    onClose={() => (detail = null)}
  />
{:else}
  <Sheet
    title={title ?? app.deckTitle(run.deck.length)}
    {onClose}
    actions={onPickMany ? confirmAction : undefined}
  >
    {#if hint}<p class="hint">{hint}</p>{/if}
    {#if inPlay && !picking}<p class="hint">{app.deckPlayed}</p>{/if}
    <div class="grid">
      {#each entries as instance (instance.uid)}
        <button
          type="button"
          class:out={!picking && inPlay && !inPlay.has(instance.uid)}
          class:chosen={chosen.includes(instance.uid)}
          aria-label={cardOf(cardIndex, instance).name[language]}
          aria-pressed={onPickMany ? chosen.includes(instance.uid) : undefined}
          onclick={() => tap(instance)}
        >
          <GameCard
            card={cardOf(cardIndex, instance)}
            variant={instance.variant}
            energies={instance.energies}
            specials={instance.specials}
          />
        </button>
      {/each}
    </div>
  </Sheet>
{/if}

{#snippet confirmAction()}
  <button
    class="btn primary"
    type="button"
    disabled={chosen.length !== pickCount}
    onclick={confirm}
  >
    {app.confirmTargets} ({chosen.length}/{pickCount})
  </button>
{/snippet}

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

  .chosen {
    border-radius: 8px;
    outline: 3px solid var(--gold);
    outline-offset: 1px;
  }
</style>
