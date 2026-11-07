<script lang="ts">
import { TOOLS, type ToolInstance } from '../../content/tools.ts';
import {
  type CardData,
  type CardInstance,
  cardOf,
  evolvesFrom,
  type OpenBooster,
  type RunState,
} from '../../engine/index.ts';
import CardBack from '../components/CardBack.svelte';
import CardDetail from '../components/CardDetail.svelte';
import DeckSheet from '../components/DeckSheet.svelte';
import GameCard from '../components/GameCard.svelte';
import PackArt from '../components/PackArt.svelte';
import Sheet from '../components/Sheet.svelte';
import ToolDetail from '../components/ToolDetail.svelte';
import ToolRow from '../components/ToolRow.svelte';
import ToolTile from '../components/ToolTile.svelte';
import TopBar from '../components/TopBar.svelte';
import TypeIcon from '../components/TypeIcon.svelte';
import { pressable } from '../actions/pressable.ts';
import { cardIndex } from '../logic/data.ts';
import { session } from '../logic/game.ts';
import { toolLabel } from '../logic/labels.ts';
import { texts } from '../logic/texts.ts';
import { showToast } from '../logic/toasts.ts';

interface Props {
  run: RunState;
  booster: OpenBooster;
}

const { run, booster }: Props = $props();

type Step = 'sealed' | 'tearing' | 'revealing';

const text = $derived($texts.text);
const app = $derived(text.app);
const language = $derived($texts.language);

let step = $state<Step>('sealed');
let revealed = $state(0);
let chosen = $state<number | null>(null);
let zoom = $state<number | null>(null);
let picking = $state<'evolve' | 'energy' | null>(null);
let owned = $state<ToolInstance | null>(null);

const size = $derived(
  booster.kind === 'energy'
    ? booster.energies.length
    : booster.kind === 'trainer'
      ? booster.tools.length
      : booster.cards.length,
);
const allRevealed = $derived(revealed >= size);
const chosenTool = $derived(chosen === null ? null : (booster.tools[chosen] ?? null));
const hasStadium = $derived(run.tools.some((tool) => TOOLS[tool.toolId].stadium));
const toolsFull = $derived(
  booster.kind === 'trainer' &&
    run.tools.length >= run.toolSlots &&
    !(chosenTool && TOOLS[chosenTool.toolId].stadium && hasStadium),
);

const isGlowing = (position: number): boolean => {
  const entry = booster.cards[position];
  if (!entry) return false;
  const { rarity } = cardData(entry.cardId);
  return entry.variant !== 'normal' || rarity === 'Ultra Rare' || rarity === 'Secret Rare';
};

function cardData(id: string): CardData {
  return cardIndex.byId.get(id) as CardData;
}

function open(): void {
  step = 'tearing';
  setTimeout(() => {
    step = 'revealing';
  }, 420);
}

function tap(position: number): void {
  if (!allRevealed) {
    revealed += 1;
    return;
  }
  chosen = chosen === position ? null : position;
}

const evolveTargets = $derived.by<CardInstance[]>(() => {
  const entry = chosen === null ? undefined : booster.cards[chosen];
  if (!entry) return [];
  const card = cardData(entry.cardId);
  return run.deck.filter((instance) => evolvesFrom(card, cardOf(cardIndex, instance)));
});

async function act(action: Parameters<typeof session.dispatch>[0]): Promise<void> {
  const index = chosen;
  chosen = null;
  picking = null;
  const refusal = await session.dispatch(action);
  if (refusal) {
    chosen = index;
    showToast(text.illegal[refusal]);
  }
}

function keep(): void {
  if (chosen === null) return;
  if (booster.kind === 'energy') picking = 'energy';
  else if (booster.kind === 'trainer') void act({ type: 'keepBoosterTool', index: chosen });
  else if (evolveTargets.length > 0) picking = 'evolve';
  else void act({ type: 'keepBoosterCard', index: chosen });
}
</script>

<main class="screen booster">
  <TopBar
    title={booster.free ? app.boosterFree : app.boosterNames[booster.kind]}
    money={run.money}
    deckSize={run.deck.length}
  />

  {#if step !== 'revealing'}
    <div class="sealed">
      <button class="pack" type="button" aria-label={app.openBooster} onclick={open}>
        <PackArt setId={run.setId} kind={booster.kind} tearing={step === 'tearing'} />
      </button>
      <p class="hint">{app.boosterContents[booster.kind]}</p>
      <button class="btn primary" type="button" onclick={open}>{app.openBooster}</button>
    </div>
  {:else}
    <p class="prompt" aria-live="polite">
      {allRevealed ? app.pickKeep(booster.keeps) : app.tapToReveal}
    </p>

    <div
      class="items"
      use:pressable={{
        onLongPress: (id) => {
          if (Number(id) < revealed) zoom = Number(id);
        },
      }}
    >
      {#each { length: size } as _, position (position)}
        {@const shown = position < revealed}
        <button
          class="item"
          class:chosen={chosen === position}
          class:glow={shown && isGlowing(position)}
          type="button"
          data-press-id={position}
          aria-pressed={chosen === position}
          onclick={() => tap(position)}
        >
          <span class="flip" class:shown>
            <span class="face rear"><CardBack /></span>
            <span class="face front">
              {#if booster.kind === 'energy'}
                {@const energy = booster.energies[position]}
                {#if energy}
                  <span class="energy">
                    <TypeIcon type={energy} size={46} />
                    <span>{text.types[energy]}</span>
                  </span>
                {/if}
              {:else if booster.kind === 'trainer'}
                {@const tool = booster.tools[position]}
                {#if tool}
                  <span class="energy">
                    <span class="tool"><ToolTile toolId={tool.toolId} type={tool.type} /></span>
                    <span>{toolLabel(text, tool)}</span>
                  </span>
                {/if}
              {:else}
                {@const entry = booster.cards[position]}
                {#if entry}<GameCard card={cardData(entry.cardId)} variant={entry.variant} />{/if}
              {/if}
            </span>
          </span>
        </button>
      {/each}
    </div>

    {#if chosenTool}
      <p class="effect">{text.tools[chosenTool.toolId].effect}</p>
    {/if}

    {#if toolsFull}
      <section class="sell">
        <p class="hint">{app.toolsFull}</p>
        <ToolRow
      slots={run.toolSlots}
          tools={run.tools}
          onOpen={(tool) => (owned = tool)}
          onReorder={(uids) => session.dispatch({ type: 'reorderTools', uids })}
        />
      </section>
    {/if}

    <div class="actions">
      {#if allRevealed}
        <button class="btn" type="button" onclick={() => act({ type: 'skipBooster' })}>
          {app.skipBooster}
        </button>
        <button
          class="btn primary"
          type="button"
          aria-disabled={chosen === null}
          onclick={keep}
        >
          {app.keep}
        </button>
      {:else}
        <button class="btn" type="button" onclick={() => (revealed = size)}>{app.revealAll}</button>
      {/if}
    </div>
  {/if}
</main>

{#if zoom !== null && booster.cards[zoom]}
  {@const entry = booster.cards[zoom]}
  {#if entry}
    <CardDetail card={cardData(entry.cardId)} variant={entry.variant} onClose={() => (zoom = null)} />
  {/if}
{:else if zoom !== null && booster.tools[zoom]}
  {@const tool = booster.tools[zoom]}
  {#if tool}<ToolDetail {tool} onClose={() => (zoom = null)} />{/if}
{/if}

{#if picking === 'energy' && chosen !== null}
  {@const index = chosen}
  <DeckSheet
    {run}
    title={app.pickTarget}
    onPick={(target) => act({ type: 'keepBoosterEnergy', index, targetUid: target.uid })}
    onClose={() => (picking = null)}
  />
{/if}

{#if picking === 'evolve' && chosen !== null}
  {@const index = chosen}
  <Sheet title={app.keep} onClose={() => (picking = null)}>
    <div class="choices">
      <button class="btn primary" type="button" onclick={() => act({ type: 'keepBoosterCard', index })}>
        {app.addToDeck}
      </button>
      <p class="hint">{app.evolveHint}</p>
      {#each evolveTargets as target (target.uid)}
        <button
          class="btn"
          type="button"
          onclick={() => act({ type: 'keepBoosterCard', index, evolveUid: target.uid })}
        >
          {app.evolveInto(cardOf(cardIndex, target).name[language])}
        </button>
      {/each}
    </div>
  </Sheet>
{/if}

{#if owned}
  {@const tool = owned}
  <ToolDetail {tool} onClose={() => (owned = null)}>
    {#snippet actions()}
      <button
        class="btn"
        type="button"
        onclick={() => {
          owned = null;
          void session.dispatch({ type: 'sellTool', uid: tool.uid });
        }}
      >
        {app.sellFor(Math.floor(tool.price / 2))}
      </button>
    {/snippet}
  </ToolDetail>
{/if}

<style>
  .sealed {
    display: grid;
    flex: 1;
    align-content: center;
    gap: 14px;
    justify-items: center;
  }

  .pack {
    width: min(58vw, 34dvh);
    padding: 0;
    border: 0;
    background: none;
  }

  .prompt {
    color: var(--gold);
    font-family: var(--font-display);
    text-align: center;
  }

  .hint {
    color: var(--muted);
    font-size: 0.88rem;
    text-align: center;
  }

  .effect {
    flex: none;
    text-align: center;
  }

  .items {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    gap: 8px;
    min-height: 0;
    overflow-y: auto;
  }

  .item {
    width: min(30%, 21dvh);
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: none;
    perspective: 700px;
    transition: scale 140ms ease;
    -webkit-touch-callout: none;
    user-select: none;
  }

  .item.chosen {
    scale: 1.06;
    box-shadow: 0 0 0 3px var(--gold);
  }

  .item.glow {
    filter: drop-shadow(0 0 9px rgb(255 201 77 / 75%));
  }

  .flip {
    position: relative;
    display: block;
    aspect-ratio: 245 / 337;
    transform-style: preserve-3d;
    transition: transform 420ms cubic-bezier(0.3, 0.7, 0.3, 1);
  }

  .flip.shown {
    transform: rotateY(180deg);
  }

  .face {
    position: absolute;
    inset: 0;
    display: block;
    backface-visibility: hidden;
  }

  .front {
    transform: rotateY(180deg);
  }

  .energy {
    display: grid;
    gap: 6px;
    place-content: center;
    place-items: center;
    width: 100%;
    height: 100%;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    font-size: 0.82rem;
    line-height: 1.15;
    text-align: center;
  }

  .tool {
    width: 56px;
    height: 56px;
  }

  .sell {
    display: grid;
    flex: none;
    gap: 6px;
  }

  .actions {
    display: grid;
    flex: none;
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
    gap: 8px;
  }

  .choices {
    display: grid;
    gap: 8px;
  }
</style>
