<script lang="ts">
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import type { ToolInstance } from '../../content/tools.ts';
import {
  type CardData,
  cardOf,
  evolvesFrom,
  type RunState,
  type ShopSlot,
  type ShopState,
} from '../../engine/index.ts';
import CardDetail from '../components/CardDetail.svelte';
import GameCard from '../components/GameCard.svelte';
import PackArt from '../components/PackArt.svelte';
import ToolDetail from '../components/ToolDetail.svelte';
import ToolRow from '../components/ToolRow.svelte';
import ToolTile from '../components/ToolTile.svelte';
import TopBar from '../components/TopBar.svelte';
import { cardIndex } from '../logic/data.ts';
import { session } from '../logic/game.ts';
import { toolLabel } from '../logic/labels.ts';
import { texts } from '../logic/texts.ts';
import { showToast } from '../logic/toasts.ts';

interface Props {
  run: RunState;
  shop: ShopState;
}

const { run, shop }: Props = $props();

const text = $derived($texts.text);
const app = $derived(text.app);
const language = $derived($texts.language);

let openSlot = $state<number | null>(null);
let owned = $state<ToolInstance | null>(null);

const slot = $derived(openSlot === null ? null : (shop.slots[openSlot] ?? null));
const slotCard = $derived(slot?.kind === 'card' ? cardData(slot.cardId) : null);
const evolveTargets = $derived(
  slotCard ? run.deck.filter((entry) => evolvesFrom(slotCard, cardOf(cardIndex, entry))) : [],
);

function cardData(id: string): CardData {
  return cardIndex.byId.get(id) as CardData;
}

function nameOf(entry: ShopSlot): string {
  return entry.kind === 'card' ? cardData(entry.cardId).name[language] : toolLabel(text, entry);
}

async function act(action: Parameters<typeof session.dispatch>[0]): Promise<void> {
  const refusal = await session.dispatch(action);
  if (refusal) showToast(text.illegal[refusal]);
}

async function buy(evolveUid?: number): Promise<void> {
  if (openSlot === null) return;
  const index = openSlot;
  openSlot = null;
  await act({ type: 'buySlot', index, ...(evolveUid === undefined ? {} : { evolveUid }) });
}

async function sell(uid: number): Promise<void> {
  owned = null;
  await act({ type: 'sellTool', uid });
}
</script>

<main class="screen shop">
  <TopBar title={app.shop} money={run.money} deckSize={run.deck.length} />

  <div class="scroll">
    <section class="slots">
      {#each shop.slots as entry, index (index)}
        {#if entry}
          <button
            class="item"
            type="button"
            aria-label={`${nameOf(entry)}, ${entry.price} ₽`}
            onclick={() => (openSlot = index)}
          >
            <span class="visual">
              {#if entry.kind === 'card'}
                <GameCard card={cardData(entry.cardId)} variant={entry.variant} />
              {:else}
                <span class="tool"><ToolTile toolId={entry.toolId} type={entry.type} /></span>
              {/if}
            </span>
            <span class="name">{nameOf(entry)}</span>
            <span class="price">{entry.price} ₽</span>
          </button>
        {:else}
          <span class="item sold">{app.sold}</span>
        {/if}
      {/each}

      {#each shop.boosters as booster, index (index)}
        {#if booster}
          <button
            class="item"
            type="button"
            aria-label={`${app.boosterNames[booster.kind]}, ${booster.price} ₽`}
            onclick={() => act({ type: 'buyBooster', index })}
          >
            <span class="visual pack"><PackArt kind={booster.kind} /></span>
            <span class="name">{app.boosterContents[booster.kind]}</span>
            <span class="price">{booster.price} ₽</span>
          </button>
        {:else}
          <span class="item sold">{app.sold}</span>
        {/if}
      {/each}
    </section>
  </div>

  <section class="owned">
    <h2>{app.yourTools}</h2>
    <ToolRow
      tools={run.tools}
      onOpen={(tool) => (owned = tool)}
      onReorder={(uids) => session.dispatch({ type: 'reorderTools', uids })}
    />
  </section>

  <div class="actions">
    <button class="btn" type="button" onclick={() => act({ type: 'reroll' })}>
      <RefreshCw size={16} aria-hidden="true" />{app.reroll(shop.rerollCost)}
    </button>
    <button class="btn primary" type="button" onclick={() => act({ type: 'leaveShop' })}>
      {app.nextFight}
    </button>
  </div>
</main>

{#if slot?.kind === 'card' && slotCard}
  <CardDetail card={slotCard} variant={slot.variant} onClose={() => (openSlot = null)}>
    {#snippet actions()}
      <button class="btn primary" type="button" onclick={() => buy()}>
        {app.buy(slot.price)}
      </button>
      {#if evolveTargets.length > 0}
        <p class="hint">{app.evolveHint}</p>
      {/if}
      {#each evolveTargets as target (target.uid)}
        <button class="btn" type="button" onclick={() => buy(target.uid)}>
          {app.evolveInto(cardOf(cardIndex, target).name[language])}
        </button>
      {/each}
    {/snippet}
  </CardDetail>
{:else if slot?.kind === 'tool'}
  <ToolDetail tool={slot} onClose={() => (openSlot = null)}>
    {#snippet actions()}
      <button class="btn primary" type="button" onclick={() => buy()}>
        {app.buy(slot.price)}
      </button>
    {/snippet}
  </ToolDetail>
{/if}

{#if owned}
  {@const tool = owned}
  <ToolDetail {tool} onClose={() => (owned = null)}>
    {#snippet actions()}
      <button class="btn" type="button" onclick={() => sell(tool.uid)}>
        {app.sellFor(Math.floor(tool.price / 2))}
      </button>
    {/snippet}
  </ToolDetail>
{/if}

<style>
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .slots {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  @media (min-width: 620px), (min-aspect-ratio: 5/4) {
    .slots {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  .item {
    display: grid;
    gap: 3px;
    justify-items: center;
    align-content: start;
    min-height: 120px;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    text-align: center;
  }

  .item.sold {
    place-items: center;
    align-content: center;
    color: var(--muted);
    background: none;
    border-style: dashed;
  }

  .visual {
    display: grid;
    place-items: center;
    width: min(100%, 15.5dvh);
  }

  .visual.pack {
    width: min(84%, 14dvh);
  }

  .tool {
    width: 72px;
    height: 72px;
    margin: 18px 0;
  }

  .name {
    display: grid;
    place-items: center;
    width: 100%;
    min-height: 2.3em;
    font-size: 0.82rem;
    line-height: 1.15;
  }

  .price {
    color: var(--gold);
    font-family: var(--font-display);
    font-weight: 600;
  }

  .owned {
    display: grid;
    flex: none;
    gap: 4px;
  }

  .owned h2 {
    color: var(--muted);
    font-family: var(--font-body);
    font-size: 0.85rem;
    font-weight: 600;
  }

  .actions {
    display: grid;
    flex: none;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .hint {
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
