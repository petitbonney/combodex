<script lang="ts">
import ArrowLeft from '@lucide/svelte/icons/arrow-left';
import Lock from '@lucide/svelte/icons/lock';
import { CUSTOM_DECK_RATIO, SETS } from '../../content/sets.ts';
import { OBJECTIVES } from '../../content/objectives.ts';
import {
  completeLines,
  completion,
  isCustomDeckUnlocked,
  isSetUnlocked,
  lockedTools,
  objectiveOfSet,
} from '../../engine/index.ts';
import TypeIcon from '../components/TypeIcon.svelte';
import { indexOfSet } from '../logic/data.ts';
import { progress, session } from '../logic/game.ts';
import { menuScreen } from '../logic/panels.ts';
import { texts } from '../logic/texts.ts';

const text = $derived($texts.text);
const app = $derived(text.app);
const language = $derived($texts.language);

let setId = $state(SETS[0]?.id ?? '');
let custom = $state(false);
let lines = $state<number[]>([]);

const index = $derived(indexOfSet(setId));
const customUnlocked = $derived(isCustomDeckUnlocked($progress, index));
const available = $derived(completeLines(index));
const ready = $derived(!custom || lines.length === 2);

function lockHint(id: string): string {
  const objective = objectiveOfSet(id);
  if (!objective || OBJECTIVES[objective].hidden) return app.setMystery;
  return text.objectives[objective].condition;
}

function choose(id: string): void {
  setId = id;
  custom = false;
  lines = [];
}

function toggleLine(position: number): void {
  if (lines.includes(position)) {
    lines = lines.filter((line) => line !== position);
    return;
  }
  const taken = lines.map((line) => available[line]?.type);
  if (lines.length < 2 && !taken.includes(available[position]?.type)) {
    lines = [...lines, position];
  }
}

function start(): void {
  menuScreen.set('title');
  session.newRun({
    setId,
    seed: Date.now() % 2147483647,
    lockedTools: lockedTools($progress),
    starterLines: custom ? lines : null,
  });
}
</script>

<main class="screen setup">
  <header>
    <button
      class="icon-btn"
      type="button"
      aria-label={app.back}
      onclick={() => menuScreen.set('title')}
    >
      <ArrowLeft size={20} aria-hidden="true" />
    </button>
    <h1>{app.chooseSet}</h1>
  </header>

  <div class="scroll">
    <ul class="sets">
      {#each SETS as { id } (id)}
        {@const unlocked = isSetUnlocked($progress, id)}
        {@const done = completion($progress, indexOfSet(id))}
        <li>
          <button
            class="set"
            class:current={id === setId}
            type="button"
            disabled={!unlocked}
            aria-pressed={id === setId}
            onclick={() => choose(id)}
          >
            <strong>{indexOfSet(id).set.name[language]}</strong>
            {#if unlocked}
              <small>{app.binderProgress(done.seen, done.total, Math.floor(done.ratio * 100))}</small>
            {:else}
              <small class="locked">
                <Lock size={13} aria-hidden="true" />{lockHint(id)}
              </small>
            {/if}
          </button>
        </li>
      {/each}
    </ul>

    <div class="modes" role="group" aria-label={app.deck}>
      <button class="btn" class:primary={!custom} type="button" onclick={() => (custom = false)}>
        {app.deckRandom}
      </button>
      <button
        class="btn"
        class:primary={custom}
        type="button"
        disabled={!customUnlocked}
        onclick={() => (custom = true)}
      >
        {app.deckCustom}
      </button>
    </div>
    {#if !customUnlocked}
      <p class="hint">{app.deckCustomLocked(CUSTOM_DECK_RATIO * 100)}</p>
    {/if}

    {#if custom}
      <p class="hint">{app.pickLines}</p>
      <ul class="lines">
        {#each available as line, position (position)}
          {@const top = line.stage2[0]}
          <li>
            <button
              class="line"
              class:current={lines.includes(position)}
              type="button"
              aria-pressed={lines.includes(position)}
              onclick={() => toggleLine(position)}
            >
              <TypeIcon type={line.type} size={20} />
              {app.lineLabel(top?.name[language] ?? '', text.types[line.type])}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <button class="btn primary" type="button" disabled={!ready} onclick={start}>{app.startRun}</button>
</main>

<style>
  header {
    display: flex;
    flex: none;
    gap: 10px;
    align-items: center;
  }

  h1 {
    font-size: 1.3rem;
  }

  .scroll {
    display: grid;
    flex: 1;
    align-content: start;
    gap: 10px;
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

  .set,
  .line {
    display: flex;
    width: 100%;
    min-height: 48px;
    padding: 8px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    text-align: left;
  }

  .set {
    flex-direction: column;
    gap: 2px;
  }

  .line {
    gap: 10px;
    align-items: center;
  }

  .set:disabled {
    opacity: 0.7;
  }

  .current {
    border-color: var(--gold);
    box-shadow: inset 0 0 0 1px var(--gold);
  }

  small {
    color: var(--muted);
    font-size: 0.82rem;
  }

  .locked {
    display: inline-flex;
    gap: 5px;
    align-items: center;
  }

  .modes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .hint {
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
