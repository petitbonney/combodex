<script lang="ts">
import ArrowDownWideNarrow from '@lucide/svelte/icons/arrow-down-wide-narrow';
import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
import Coins from '@lucide/svelte/icons/coins';
import Eye from '@lucide/svelte/icons/eye';
import Footprints from '@lucide/svelte/icons/footprints';
import Hourglass from '@lucide/svelte/icons/hourglass';
import Layers from '@lucide/svelte/icons/layers';
import Network from '@lucide/svelte/icons/network';
import Repeat2 from '@lucide/svelte/icons/repeat-2';
import Settings from '@lucide/svelte/icons/settings';
import Sparkles from '@lucide/svelte/icons/sparkles';
import type { StatusId } from '../../content/statuses.ts';
import type { ToolInstance } from '../../content/tools.ts';
import {
  type CardData,
  cardOf,
  currentRules,
  type FightState,
  instanceOf,
  isHidden,
  isPreviewMasked,
  isStrong,
  maxPlayed,
  permanentType,
  previewHand,
  retreatCost,
  type RunState,
  scoutedCards,
} from '../../engine/index.ts';
import AceSheet from '../components/AceSheet.svelte';
import CardDetail from '../components/CardDetail.svelte';
import GameCard from '../components/GameCard.svelte';
import Hand, { type HandEntry } from '../components/Hand.svelte';
import PlayZone, { type ZoneEntry } from '../components/PlayZone.svelte';
import ScoreCounter from '../components/ScoreCounter.svelte';
import Sheet from '../components/Sheet.svelte';
import StageOverlay from '../components/StageOverlay.svelte';
import ToolDetail from '../components/ToolDetail.svelte';
import ToolRow from '../components/ToolRow.svelte';
import TypeIcon from '../components/TypeIcon.svelte';
import { cardIndex } from '../logic/data.ts';
import { formatBonus, formatNumber } from '../logic/format.ts';
import { session } from '../logic/game.ts';
import { moveItem, type SortMode, sortHand, syncOrder, toggleSelection } from '../logic/hand.ts';
import { panel } from '../logic/panels.ts';
import { texts } from '../logic/texts.ts';
import { showToast } from '../logic/toasts.ts';

interface Props {
  run: RunState;
  fight: FightState;
}

const { run, fight }: Props = $props();

type Info = { title: string; body: string };

const text = $derived($texts.text);
const app = $derived(text.app);
const language = $derived($texts.language);
const stage = $derived($session.stage);
const busy = $derived($session.busy);

let manualOrder = $state<number[]>([]);
let selected = $state<number[]>([]);
let zoomUid = $state<number | null>(null);
let toolInfo = $state<ToolInstance | null>(null);
let info = $state<Info | null>(null);
let opponentZoom = $state(false);
let aceOpen = $state(false);

const handOrder = $derived(syncOrder(manualOrder, fight.hand));
const picked = $derived(selected.filter((uid) => fight.hand.includes(uid)));
const limit = $derived(maxPlayed(run, fight));
const rules = $derived(currentRules(fight));
const strong = $derived(isStrong(run));
const opponent = $derived(fight.opponent);
const permanent = $derived(permanentType(opponent));
const ace = $derived(run.aceSpec);
const opponentCard = $derived(cardIndex.byId.get(opponent.cardId) as CardData);
const hp = $derived(stage.hp ?? opponent.hp);
const disabledTools = $derived([...fight.fightDisabledToolUids, ...fight.turnDisabledToolUids]);
const scouted = $derived(scoutedCards(run, fight, cardIndex));

const handEntries = $derived<HandEntry[]>(
  handOrder.flatMap((uid, position) => {
    if (picked.includes(uid)) return [];
    const instance = instanceOf(run, uid);
    return [
      {
        uid,
        shortcut: position + 1,
        instance,
        card: cardOf(cardIndex, instance),
        hidden: isHidden(fight, uid),
        paralyzed: fight.paralyzedUids.includes(uid),
        forced: fight.forcedUids.includes(uid),
      },
    ];
  }),
);

const zoneEntries = $derived<ZoneEntry[]>(
  (stage.playedUids ?? picked).map((uid) => {
    const instance = instanceOf(run, uid);
    return { uid, instance, card: cardOf(cardIndex, instance), hidden: isHidden(fight, uid) };
  }),
);

const preview = $derived(
  picked.length > 0 && !stage.counter ? previewHand(run, cardIndex, picked) : null,
);
const masked = $derived(!stage.counter && picked.length > 0 && isPreviewMasked(fight, picked));

const counter = $derived({
  combo: stage.combo ?? preview?.countedCombo ?? null,
  damage: stage.counter?.damage ?? preview?.damage ?? null,
  mult: stage.counter?.mult ?? preview?.mult ?? null,
  score: stage.score ?? (preview ? preview.score + preview.flatDamage : null),
  estimated: stage.score === null,
});

const note = $derived.by(() => {
  const { beat } = stage;
  if (beat?.kind === 'modifier') return beat.label;
  if (beat?.kind === 'combo' && beat.demotedFrom) {
    return app.demoted(text.combos[beat.demotedFrom], text.combos[beat.combo]);
  }
  return null;
});

const toolPopup = $derived.by(() => {
  const { beat } = stage;
  return beat?.kind === 'tool'
    ? formatBonus({ ...beat, damage: beat.addDamage }, app.multLabel, language)
    : null;
});

const hit = $derived(stage.beat?.kind === 'hit' ? stage.beat.amount : null);

const discardCost = $derived(
  picked.reduce((sum, uid) => sum + retreatCost(run, fight, cardIndex, uid), 0),
);

const playRefusal = $derived(
  picked.length > 0 && !busy ? session.refusal({ type: 'play', uids: picked }) : null,
);
const discardRefusal = $derived(
  picked.length > 0 && !busy ? session.refusal({ type: 'discard', uids: picked }) : null,
);

/** L'Échange s'offre quand une seule carte, qui a ce talent, est sélectionnée. */
const swapUid = $derived.by(() => {
  const [uid] = picked;
  if (uid === undefined || picked.length !== 1 || isHidden(fight, uid)) return null;
  if (cardOf(cardIndex, instanceOf(run, uid)).abilityFamily !== 'switch') return null;
  return session.refusal({ type: 'swap', uid }) === null ? uid : null;
});

function statusEffect(id: StatusId): string {
  return strong ? text.statuses[id].strong : text.statuses[id].base;
}

function toggle(uid: number): void {
  if (busy) return;
  selected = toggleSelection(picked, uid, limit);
}

function sort(mode: SortMode): void {
  manualOrder = sortHand(handOrder, run, cardIndex, mode, (uid) => isHidden(fight, uid));
}

function reorderHand(from: number, to: number): void {
  const moved = moveItem(
    handEntries.map((entry) => entry.uid),
    from,
    to,
  );
  manualOrder = [...moved, ...picked];
}

function refuse(reason: Parameters<typeof showToast>[0] | null): void {
  if (reason) showToast(reason);
}

async function play(): Promise<void> {
  if (busy) return;
  if (picked.length === 0) return refuse(app.pickCards);
  if (playRefusal) return refuse(text.illegal[playRefusal]);
  await session.dispatch({ type: 'play', uids: picked });
  selected = [];
}

async function discard(): Promise<void> {
  if (busy) return;
  if (picked.length === 0) return refuse(app.pickCards);
  if (discardRefusal) return refuse(text.illegal[discardRefusal]);
  await session.dispatch({ type: 'discard', uids: picked });
  selected = [];
}

async function swap(uid: number): Promise<void> {
  await session.dispatch({ type: 'swap', uid });
  selected = [];
}

function zoom(uid: number): void {
  if (!isHidden(fight, uid)) zoomUid = uid;
}

function onKey(event: KeyboardEvent): void {
  if (document.querySelector('dialog[open]')) return;
  const onButton = event.target instanceof HTMLButtonElement;
  if (busy) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      session.skip();
    }
    return;
  }
  if (event.key === 'Enter' && !onButton) void play();
  else if (event.key === 'd' || event.key === 'D') void discard();
  else if (event.key === 't' || event.key === 'T') sort('type');
  else if (/^[1-9]$/.test(event.key)) {
    const uid = handOrder[Number(event.key) - 1];
    if (uid !== undefined) toggle(uid);
  }
}

const zoomed = $derived(zoomUid === null ? null : instanceOf(run, zoomUid));
</script>

<svelte:window onkeydown={onKey} />

<main class="fight">
  <section class="opponent">
    <button
      class="portrait"
      type="button"
      aria-label={opponentCard.name[language]}
      onclick={() => (opponentZoom = true)}
    >
      <GameCard card={opponentCard} plain />
    </button>
    <div class="details">
      <div class="name-row">
        <h1>{opponentCard.name[language]}</h1>
        <button
          class="icon-btn small"
          type="button"
          aria-label={app.menu}
          onclick={() => panel.set('settings')}
        >
          <Settings size={18} aria-hidden="true" />
        </button>
      </div>
      <div class="hp" role="meter" aria-label={app.hp} aria-valuemin={0} aria-valuemax={opponent.maxHp} aria-valuenow={hp}>
        <span class="fill" style:transform="scaleX({hp / opponent.maxHp})"></span>
        <span class="hp-text">{formatNumber(hp, language)} / {formatNumber(opponent.maxHp, language)}</span>
        {#if hit !== null}<span class="hit">−{formatNumber(hit, language)}</span>{/if}
      </div>
      <div class="meta">
        <span class="kind">{text.opponents[opponent.kind]}</span>
        <span class="tag">
          {app.weaknessShort}
          {#each opponent.weaknesses as type (type)}<TypeIcon {type} size={17} />{:else}–{/each}
        </span>
        <span class="tag">
          {app.resistanceShort}
          {#each opponent.resistances as type (type)}<TypeIcon {type} size={17} />{:else}–{/each}
        </span>
      </div>
    </div>
  </section>

  <section class="stats" aria-label={app.turn}>
    <span title={app.turn}><Hourglass size={15} aria-hidden="true" /><span class="sr-only">{app.turn}</span>{app.turnValue(fight.turn, fight.maxTurns)}</span>
    <span title={app.retreat}><Footprints size={15} aria-hidden="true" /><span class="sr-only">{app.retreat}</span>{fight.retreatPoints}</span>
    <span class="money"><Coins size={15} aria-hidden="true" />{run.money} ₽</span>
    <button type="button" aria-label={app.deckTitle(run.deck.length)} onclick={() => panel.set('deck')}>
      <Layers size={15} aria-hidden="true" />{fight.drawPile.length}
    </button>
  </section>

  <section class="status">
    {#if permanent}
      <button
        class="chip"
        class:wide={opponent.form === 'permanent'}
        class:icon={opponent.form !== 'permanent'}
        type="button"
        aria-label={app.permanentEffect}
        onclick={() => (info = { title: app.permanentEffect, body: text.permanents[permanent] })}
      >
        {#if opponent.form === 'permanent'}
          {text.permanents[permanent]}
        {:else}
          <TypeIcon type={permanent} size={17} />
        {/if}
      </button>
    {/if}
    {#if opponent.form === 'statuses'}
      {@const active = fight.activeStatus}
      {@const next = fight.announcedStatus}
      <button
        class="chip"
        class:danger={active}
        type="button"
        onclick={() =>
          active &&
          (info = {
            title: text.statuses[active.id].name,
            body: active.strong ? text.statuses[active.id].strong : text.statuses[active.id].base,
          })}
      >
        <small>{app.statusNow}</small>
        {active ? text.statuses[active.id].name : app.statusNone}
      </button>
      <button
        class="chip"
        class:warn={next}
        type="button"
        onclick={() =>
          next && (info = { title: text.statuses[next].name, body: statusEffect(next) })}
      >
        <small>{app.statusNext}</small>
        {next ? text.statuses[next].name : app.statusNone}
      </button>
    {/if}
    {#if ace}
      <button
        class="chip icon gold"
        type="button"
        aria-label={`${app.aceTag} : ${text.aces[ace].name}`}
        onclick={() => (aceOpen = true)}
      >
        <Sparkles size={16} aria-hidden="true" />
      </button>
    {/if}
    {#if fight.poisonPercent > 0}
      <span class="chip danger">{app.poison(Math.round(fight.poisonPercent * 100))}</span>
    {/if}
    {#if scouted.length > 0}
      <button
        class="chip icon"
        type="button"
        aria-label={app.scouted}
        onclick={() =>
          (info = {
            title: app.scouted,
            body: scouted
              .map((uid) => cardOf(cardIndex, instanceOf(run, uid)).name[language])
              .join(', '),
          })}
      >
        <Eye size={16} aria-hidden="true" />
      </button>
    {/if}
  </section>

  <div class="score">
    <ScoreCounter
      combo={counter.combo}
      damage={counter.damage}
      mult={counter.mult}
      score={counter.score}
      estimated={counter.estimated}
      {masked}
      {note}
    />
  </div>

  <div class="tools">
    <ToolRow
      slots={run.toolSlots}
      tools={run.tools}
      disabledUids={disabledTools}
      litUid={stage.litTool}
      popup={toolPopup}
      locked={busy}
      onOpen={(tool) => (toolInfo = tool)}
      onReorder={(uids) => session.dispatch({ type: 'reorderTools', uids })}
    />
  </div>

  <div class="zone-area">
    <PlayZone
      entries={zoneEntries}
      {stage}
      maskDamage={rules.hideCardDamage}
      locked={busy}
      onRemove={toggle}
      onLongPress={zoom}
      onReorder={(from, to) => (selected = moveItem(picked, from, to))}
    />
  </div>

  <div class="hand-area">
    <Hand
      entries={handEntries}
      maskDamage={rules.hideCardDamage}
      locked={busy}
      onToggle={toggle}
      onLongPress={zoom}
      onReorder={reorderHand}
    />
  </div>

  <div class="actions">
    {#if busy}
      <button class="btn skip" type="button" onclick={() => session.skip()}>
        <ChevronsRight size={18} aria-hidden="true" />{app.skip}
      </button>
    {:else}
      <button
        class="btn"
        type="button"
        aria-disabled={picked.length === 0 || discardRefusal !== null}
        onclick={discard}
      >
        {picked.length > 0 ? app.discardCost(discardCost) : app.discard}
      </button>
      {#if swapUid !== null}
        {@const uid = swapUid}
        <button class="btn" type="button" onclick={() => swap(uid)}>
          <Repeat2 size={18} aria-hidden="true" />{app.swap}
        </button>
      {:else}
        <button class="icon-btn sort" type="button" aria-label={app.sortByType} title={app.sortByType} onclick={() => sort('type')}>
          <ArrowDownWideNarrow size={20} aria-hidden="true" />
        </button>
        <button class="icon-btn sort" type="button" aria-label={app.sortByLine} title={app.sortByLine} onclick={() => sort('line')}>
          <Network size={20} aria-hidden="true" />
        </button>
      {/if}
      <button
        class="btn primary"
        type="button"
        aria-disabled={picked.length === 0 || playRefusal !== null}
        onclick={play}
      >
        {app.play}
      </button>
    {/if}
  </div>

  <StageOverlay {strong} />
</main>

{#if fight.searchChoices && !busy}
  <Sheet title={app.searchTitle}>
    <p class="search-hint">{app.searchHint}</p>
    <div class="search">
      {#each fight.searchChoices as uid (uid)}
        {@const instance = instanceOf(run, uid)}
        <button
          type="button"
          aria-label={cardOf(cardIndex, instance).name[language]}
          onclick={() => session.dispatch({ type: 'resolveSearch', uid })}
        >
          <GameCard card={cardOf(cardIndex, instance)} variant={instance.variant} energies={instance.energies} specials={instance.specials} />
        </button>
      {/each}
    </div>
  </Sheet>
{/if}

{#if zoomed}
  <CardDetail
    card={cardOf(cardIndex, zoomed)}
    variant={zoomed.variant}
    energies={zoomed.energies}
    specials={zoomed.specials}
    maskDamage={rules.hideCardDamage}
    onClose={() => (zoomUid = null)}
  />
{/if}

{#if aceOpen}
  <AceSheet {run} onClose={() => (aceOpen = false)} />
{/if}

{#if opponentZoom}
  <CardDetail card={opponentCard} onClose={() => (opponentZoom = false)} />
{/if}

{#if toolInfo}
  <ToolDetail
    tool={toolInfo}
    disabled={disabledTools.includes(toolInfo.uid)}
    onClose={() => (toolInfo = null)}
  />
{/if}

{#if info}
  <Sheet title={info.title} onClose={() => (info = null)}>
    <p>{info.body}</p>
  </Sheet>
{/if}

<style>
  .fight {
    --card-w: min(23vw, 15dvh);
    --zone-w: min(17.5vw, 11dvh);

    position: relative;
    display: grid;
    grid-template-rows: auto auto auto auto auto minmax(0, 1fr) auto auto;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'opponent'
      'stats'
      'status'
      'score'
      'tools'
      'zone'
      'hand'
      'actions';
    gap: 5px;
    height: 100%;
    max-width: 560px;
    margin: 0 auto;
    padding: calc(6px + var(--safe-top)) calc(8px + var(--safe-right))
      calc(6px + var(--safe-bottom)) calc(8px + var(--safe-left));
    overflow: hidden;
  }

  .opponent {
    grid-area: opponent;
    display: flex;
    gap: 8px;
    align-items: stretch;
  }

  .portrait {
    flex: none;
    width: 50px;
    padding: 0;
    border: 0;
    background: none;
  }

  .details {
    display: grid;
    flex: 1;
    gap: 3px;
    min-width: 0;
  }

  .name-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  h1 {
    min-width: 0;
    overflow: hidden;
    font-size: 1.05rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-btn.small {
    flex: none;
    width: 34px;
    height: 30px;
    border-radius: var(--radius-small);
  }

  .hp {
    position: relative;
    height: 20px;
    overflow: visible;
    border-radius: 7px;
    background: var(--surface);
  }

  .fill {
    position: absolute;
    inset: 0;
    border-radius: 7px;
    background: linear-gradient(90deg, #2bb673, var(--good));
    transform-origin: left;
    transition: transform 500ms ease-out;
  }

  .hp-text {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--text);
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 500;
    text-shadow: 0 1px 2px rgb(0 0 0 / 90%);
  }

  .hit {
    position: absolute;
    top: -2px;
    right: 4px;
    color: var(--bad);
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 600;
    text-shadow: 0 1px 3px rgb(0 0 0 / 90%);
    animation: hit 600ms ease-out both;
  }

  @keyframes hit {
    from {
      translate: 0 12px;
      opacity: 0;
    }

    30% {
      translate: 0 0;
      opacity: 1;
    }
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 8px;
    color: var(--muted);
    font-size: 0.78rem;
  }

  .kind {
    color: var(--gold);
    font-family: var(--font-display);
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .stats {
    grid-area: stats;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    font-family: var(--font-display);
    font-size: 0.92rem;
    font-weight: 500;
  }

  .stats > * {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 28px;
    border: 0;
    border-radius: 7px;
    background: var(--surface);
  }

  .status {
    grid-area: status;
    display: flex;
    gap: 4px;
    min-width: 0;
  }

  .chip {
    flex: 1 1 0;
    min-width: 0;
    min-height: 30px;
    overflow: hidden;
    padding: 1px 8px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.8rem;
    line-height: 1.15;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip small {
    display: block;
    color: var(--muted);
    font-size: 0.68rem;
  }

  .chip.wide {
    display: -webkit-box;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .chip.gold {
    border-color: var(--gold);
    color: var(--gold);
  }

  .chip.warn {
    border-color: var(--gold);
  }

  .chip.danger {
    border-color: var(--bad);
  }

  .chip.icon {
    display: grid;
    flex: none;
    width: 40px;
    place-items: center;
  }

  .score {
    grid-area: score;
  }

  .tools {
    grid-area: tools;
  }

  .zone-area {
    grid-area: zone;
    display: flex;
    min-height: 0;
  }

  .hand-area {
    grid-area: hand;
    min-width: 0;
  }

  .actions {
    grid-area: actions;
    display: flex;
    gap: 6px;
  }

  .actions .btn {
    flex: 1;
    min-width: 0;
    padding: 0 6px;
    font-size: 0.95rem;
    white-space: nowrap;
  }

  .actions .primary {
    flex: 1.3;
  }

  .sort {
    flex: none;
    height: 46px;
  }

  .skip {
    background: var(--surface);
  }

  .search-hint {
    margin-bottom: 8px;
    color: var(--muted);
  }

  .search {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .search button {
    padding: 0;
    border: 0;
    background: none;
  }

  /* Paysage : le même écran, en deux colonnes. */
  @media (min-aspect-ratio: 5/4) {
    .fight {
      --card-w: min(11vw, 24dvh);
      --zone-w: min(9vw, 20dvh);

      grid-template-rows: auto auto auto auto minmax(0, 1fr) auto auto;
      grid-template-columns: minmax(250px, 34%) minmax(0, 1fr);
      grid-template-areas:
        'opponent zone'
        'stats zone'
        'status zone'
        'score zone'
        '. zone'
        'tools hand'
        'actions hand';
      max-width: 1100px;
      column-gap: 14px;
    }

    .tools,
    .hand-area,
    .actions {
      align-self: end;
    }

    .portrait {
      width: 64px;
    }
  }

  /* Téléphone en paysage : la hauteur manque. */
  @media (min-aspect-ratio: 5/4) and (max-height: 430px) {
    .fight {
      --card-w: min(11vw, 29dvh);

      gap: 3px;
    }

    .portrait {
      width: 42px;
    }

    .kind {
      display: none;
    }
  }
</style>
