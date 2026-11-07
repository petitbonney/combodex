<script lang="ts">
import Cross from '@lucide/svelte/icons/cross';
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import Sparkles from '@lucide/svelte/icons/sparkles';
import Zap from '@lucide/svelte/icons/zap';
import { TOOLS, type ToolInstance } from '../../content/tools.ts';
import {
  type CardData,
  type CardInstance,
  cardOf,
  evolvesFrom,
  leapTarget,
  type RunState,
  type ShopSlot,
  type ShopState,
} from '../../engine/index.ts';
import AceSheet from '../components/AceSheet.svelte';
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
import { cardIndex, indexOfSet } from '../logic/data.ts';
import { session } from '../logic/game.ts';
import { consumableEffect, consumableLabel, toolLabel } from '../logic/labels.ts';
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
let consumableOpen = $state(false);
let consumablePicking = $state(false);
let centerOpen = $state(false);
let aceOpen = $state(false);

const slot = $derived(openSlot === null ? null : (shop.slots[openSlot] ?? null));
const consumable = $derived(shop.consumable);
const consumableTargets = $derived.by<CardInstance[]>(() => {
  if (consumable?.kind !== 'leap') return run.deck;
  const index = indexOfSet(run.setId);
  return run.deck.filter((entry) => leapTarget(index, cardOf(index, entry)) !== null);
});
const replacedStadium = $derived(
  slot?.kind === 'tool' && TOOLS[slot.toolId].stadium
    ? (run.tools.find((tool) => TOOLS[tool.toolId].stadium) ?? null)
    : null,
);

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

function buyConsumable(): void {
  if (consumable?.kind === 'ace') {
    consumableOpen = false;
    void act({ type: 'buyConsumable' });
    return;
  }
  consumableOpen = false;
  consumablePicking = true;
}

async function buyOn(target: CardInstance): Promise<void> {
  consumablePicking = false;
  await act({ type: 'buyConsumable', targetUid: target.uid });
}

async function removeFromDeck(target: CardInstance): Promise<void> {
  centerOpen = false;
  await act({ type: 'removeCard', uid: target.uid });
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
            <span class="visual pack"><PackArt setId={run.setId} kind={booster.kind} /></span>
            <span class="name">{app.boosterContents[booster.kind]}</span>
            <span class="price">{booster.price} ₽</span>
          </button>
        {:else}
          <span class="item sold">{app.sold}</span>
        {/if}
      {/each}
    </section>

  </div>

  <section class="extras">
    {#if consumable}
      <button class="extra" type="button" onclick={() => (consumableOpen = true)}>
        {#if consumable.kind === 'energy'}
          <TypeIcon type={consumable.energy} size={20} />
        {:else if consumable.kind === 'ace'}
          <Sparkles size={20} aria-hidden="true" />
        {:else}
          <Zap size={20} aria-hidden="true" />
        {/if}
        <span class="extra-name">
          {consumableLabel(text, consumable)}
          <small class="price">{consumable.price} ₽</small>
        </span>
      </button>
    {:else}
      <span class="extra sold">{app.sold}</span>
    {/if}
    <button
      class="extra"
      type="button"
      disabled={run.arenaCenterUsed}
      aria-label={run.arenaCenterUsed ? app.centerUsed : app.centerName}
      onclick={() => (centerOpen = true)}
    >
      <Cross size={20} aria-hidden="true" />
      <span class="extra-name">{app.centerName}</span>
    </button>
    {#if run.aceSpec}
      <button class="extra reserve" type="button" onclick={() => (aceOpen = true)}>
        <Sparkles size={20} aria-hidden="true" />
        <span class="extra-name">
          {text.aces[run.aceSpec].name}
          <small>{app.aceReserve}</small>
        </span>
      </button>
    {/if}
  </section>

  <section class="owned">
    <h2>{app.yourTools}</h2>
    <ToolRow
      slots={run.toolSlots}
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
      {#if replacedStadium}
        <p class="hint">{app.stadiumReplaces(toolLabel(text, replacedStadium))}</p>
      {/if}
    {/snippet}
  </ToolDetail>
{/if}

{#if consumableOpen && consumable}
  <Sheet title={consumableLabel(text, consumable)} onClose={() => (consumableOpen = false)} actions={consumableActions}>
    <p>{consumableEffect(text, consumable)}</p>
  </Sheet>
{/if}

{#snippet consumableActions()}
  <button class="btn primary" type="button" onclick={buyConsumable}>
    {app.buy(consumable?.price ?? 0)}
  </button>
{/snippet}

{#if consumablePicking}
  <DeckSheet
    {run}
    title={app.pickTargets(1)}
    candidates={consumableTargets}
    onPick={buyOn}
    onClose={() => (consumablePicking = false)}
  />
{/if}

{#if centerOpen}
  <DeckSheet
    {run}
    title={app.centerName}
    hint={app.centerHint}
    onPick={removeFromDeck}
    onClose={() => (centerOpen = false)}
  />
{/if}

{#if aceOpen}
  <AceSheet {run} onClose={() => (aceOpen = false)} />
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

  .extras {
    display: grid;
    flex: none;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: 6px;
  }

  .extra {
    display: flex;
    gap: 6px;
    align-items: center;
    min-height: 46px;
    padding: 4px 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius-small);
    background: var(--surface);
    color: var(--gold);
    text-align: left;
  }

  .extra:disabled {
    opacity: 0.5;
  }

  .extra.sold {
    justify-content: center;
    color: var(--muted);
    background: none;
    border-style: dashed;
  }

  .extra.reserve {
    border-color: var(--gold);
  }

  .extra-name {
    display: grid;
    min-width: 0;
    color: var(--text);
    font-size: 0.78rem;
    line-height: 1.15;
  }

  .extra-name small {
    color: var(--muted);
    font-size: 0.72rem;
  }

  .extra-name .price {
    color: var(--gold);
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
