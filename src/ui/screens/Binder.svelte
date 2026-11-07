<script lang="ts">
import ArrowLeft from '@lucide/svelte/icons/arrow-left';
import Check from '@lucide/svelte/icons/check';
import Lock from '@lucide/svelte/icons/lock';
import { OBJECTIVE_IDS, OBJECTIVES, type ObjectiveId } from '../../content/objectives.ts';
import { SETS } from '../../content/sets.ts';
import {
  type CardData,
  completion,
  isSetUnlocked,
  objectiveOfSet,
} from '../../engine/index.ts';
import CardBack from '../components/CardBack.svelte';
import CardDetail from '../components/CardDetail.svelte';
import GameCard from '../components/GameCard.svelte';
import { indexOfSet } from '../logic/data.ts';
import { progress } from '../logic/game.ts';
import { toolLabel } from '../logic/labels.ts';
import { menuScreen } from '../logic/panels.ts';
import { texts } from '../logic/texts.ts';

const text = $derived($texts.text);
const app = $derived(text.app);
const language = $derived($texts.language);

let tab = $state<'sets' | 'objectives'>('sets');
let openSet = $state<string | null>(null);
let detail = $state<CardData | null>(null);

const index = $derived(openSet ? indexOfSet(openSet) : null);
const seen = $derived(new Set(openSet ? ($progress.seen[openSet] ?? []) : []));

function back(): void {
  if (openSet) openSet = null;
  else menuScreen.set('title');
}

function setHint(id: string): string {
  const objective = objectiveOfSet(id);
  if (!objective || OBJECTIVES[objective].hidden) return app.setMystery;
  return text.objectives[objective].condition;
}

function reward(id: ObjectiveId): string {
  const { reward: gift } = OBJECTIVES[id];
  if (gift.kind === 'set') return app.rewardSet(indexOfSet(gift.setId).set.name[language]);
  return app.rewardTool(toolLabel(text, { toolId: gift.toolId, type: null }));
}

function isDone(id: ObjectiveId): boolean {
  return $progress.objectives.includes(id);
}
</script>

<main class="screen binder">
  <header>
    <button class="icon-btn" type="button" aria-label={app.back} onclick={back}>
      <ArrowLeft size={20} aria-hidden="true" />
    </button>
    <h1>{index ? index.set.name[language] : app.binder}</h1>
  </header>

  {#if index}
    {@const done = completion($progress, index)}
    <p class="hint">{app.binderProgress(done.seen, done.total, Math.floor(done.ratio * 100))}</p>
    <div class="grid">
      {#each index.set.cards as card (card.id)}
        {#if seen.has(card.id)}
          <button
            class="cell"
            type="button"
            aria-label={card.name[language]}
            onclick={() => (detail = card)}
          >
            <GameCard {card} plain />
          </button>
        {:else}
          <span class="cell unknown" role="img" aria-label={app.binderUnknown}>
            <CardBack />
            <small>{card.localId}</small>
          </span>
        {/if}
      {/each}
    </div>
  {:else}
    <div class="tabs" role="tablist">
      <button
        class="btn"
        class:primary={tab === 'sets'}
        type="button"
        role="tab"
        aria-selected={tab === 'sets'}
        onclick={() => (tab = 'sets')}
      >
        {app.binderSets}
      </button>
      <button
        class="btn"
        class:primary={tab === 'objectives'}
        type="button"
        role="tab"
        aria-selected={tab === 'objectives'}
        onclick={() => (tab = 'objectives')}
      >
        {app.binderObjectives}
      </button>
    </div>

    <div class="scroll">
      {#if tab === 'sets'}
        <ul>
          {#each SETS as { id } (id)}
            {@const done = completion($progress, indexOfSet(id))}
            {@const unlocked = isSetUnlocked($progress, id)}
            <li>
              <button class="row" type="button" onclick={() => (openSet = id)}>
                <strong>{indexOfSet(id).set.name[language]}</strong>
                <small>
                  {app.binderProgress(done.seen, done.total, Math.floor(done.ratio * 100))}
                </small>
                <span class="bar"><span style:width="{done.ratio * 100}%"></span></span>
                {#if !unlocked}
                  <small class="locked"><Lock size={13} aria-hidden="true" />{setHint(id)}</small>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <ul>
          {#each OBJECTIVE_IDS as id (id)}
            {@const reached = isDone(id)}
            {@const masked = OBJECTIVES[id].hidden && !reached}
            <li class="row objective" class:reached>
              <strong>
                {#if reached}<Check size={15} aria-hidden="true" />{/if}
                {masked ? app.objectiveHiddenName : text.objectives[id].name}
              </strong>
              <small>{masked ? app.objectiveHiddenCondition : text.objectives[id].condition}</small>
              <small class="reward">{masked ? app.rewardHidden : reward(id)}</small>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</main>

{#if detail}
  <CardDetail card={detail} onClose={() => (detail = null)} />
{/if}

<style>
  header {
    display: flex;
    flex: none;
    gap: 10px;
    align-items: center;
  }

  h1 {
    min-width: 0;
    overflow: hidden;
    font-size: 1.3rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hint {
    flex: none;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .tabs {
    display: grid;
    flex: none;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: grid;
    gap: 3px;
    width: 100%;
    min-height: 48px;
    padding: 8px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    text-align: left;
  }

  .objective.reached {
    border-color: var(--good);
  }

  .objective strong {
    display: inline-flex;
    gap: 5px;
    align-items: center;
  }

  small {
    color: var(--muted);
    font-size: 0.82rem;
  }

  .reward {
    color: var(--gold);
  }

  .locked {
    display: inline-flex;
    gap: 5px;
    align-items: center;
  }

  .bar {
    display: block;
    height: 6px;
    overflow: hidden;
    border-radius: 3px;
    background: var(--bg-raised);
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--foil);
  }

  .grid {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
    gap: 8px;
    align-content: start;
    min-height: 0;
    overflow-y: auto;
  }

  .cell {
    position: relative;
    display: block;
    padding: 0;
    border: 0;
    background: none;
  }

  .unknown {
    opacity: 0.45;
  }

  .unknown small {
    position: absolute;
    right: 0;
    bottom: 4px;
    left: 0;
    color: var(--text);
    font-family: var(--font-display);
    text-align: center;
  }
</style>
