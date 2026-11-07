<script lang="ts">
import Crown from '@lucide/svelte/icons/crown';
import Swords from '@lucide/svelte/icons/swords';
import User from '@lucide/svelte/icons/user';
import { cardOf, currentArena, type RunState } from '../../engine/index.ts';
import GameCard from '../components/GameCard.svelte';
import TopBar from '../components/TopBar.svelte';
import TypeIcon from '../components/TypeIcon.svelte';
import { cardIndex } from '../logic/data.ts';
import { session } from '../logic/game.ts';
import { texts } from '../logic/texts.ts';

interface Props {
  run: RunState;
}

const { run }: Props = $props();

const STAGES = ['trainer', 'elite', 'champion'] as const;
const STAGE_ICONS = [User, Swords, Crown];

const text = $derived($texts.text);
const app = $derived(text.app);
const arena = $derived(currentArena(run));
const kind = $derived(STAGES[run.stageIndex] ?? 'trainer');
const isChampion = $derived(kind === 'champion');
const champion = $derived(
  cardOf(cardIndex, { uid: -1, cardId: arena.championCardId, variant: 'normal', energies: [] }),
);
const effect = $derived(
  arena.form === 'permanent' ? text.permanents[arena.type] : app.championStatuses,
);
</script>

<main class="screen">
  <TopBar
    title={app.arenaProgress(run.arenaIndex + 1, run.arenas.length)}
    money={run.money}
    deckSize={run.deck.length}
  />

  <ol class="map">
    {#each run.arenas as stop, position (position)}
      <li class:current={position === run.arenaIndex} class:done={position < run.arenaIndex}>
        <TypeIcon type={stop.type} size={24} />
        <span class="steps">
          {#each STAGES as stage, step (stage)}
            {@const StepIcon = STAGE_ICONS[step] as typeof User}
            <span
              class="step"
              class:reached={position < run.arenaIndex ||
                (position === run.arenaIndex && step < run.stageIndex)}
              class:next={position === run.arenaIndex && step === run.stageIndex}
              title={text.opponents[stage]}
            >
              <StepIcon size={14} aria-hidden="true" />
              <span class="sr-only">{text.opponents[stage]}</span>
            </span>
          {/each}
        </span>
      </li>
    {/each}
  </ol>

  <section class="next">
    <p class="label">{app.nextOpponent}</p>
    <h2>{text.opponents[kind]}</h2>
    <p class="arena">{app.arenaTitle(run.arenaIndex + 1, text.types[arena.type])}</p>
    {#if isChampion}
      <div class="boss">
        <span class="art"><GameCard card={champion} /></span>
        <div>
          <strong>{champion.name[$texts.language]}</strong>
          <p class="label">{app.championEffect}</p>
          <p>{effect}</p>
        </div>
      </div>
    {/if}
  </section>

  <div class="actions">
    <button class="btn primary" type="button" onclick={() => session.dispatch({ type: 'startFight' })}>
      {app.fight}
    </button>
    {#if !isChampion}
      <button class="btn" type="button" onclick={() => session.dispatch({ type: 'skipFight' })}>
        {app.skipFight}
      </button>
      <p class="hint">{app.skipHint}</p>
    {/if}
  </div>
</main>

<style>
  .map {
    display: grid;
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    gap: 6px;
    justify-items: center;
    padding: 8px 4px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    opacity: 0.75;
  }

  li.current {
    border-color: var(--gold);
    opacity: 1;
  }

  li.done {
    opacity: 0.55;
  }

  .steps {
    display: flex;
    gap: 3px;
  }

  .step {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--bg-raised);
    color: var(--muted);
  }

  .step.reached {
    background: var(--good);
    color: var(--type-ink);
  }

  .step.next {
    background: var(--gold);
    color: var(--gold-ink);
  }

  .next {
    display: grid;
    flex: 1;
    align-content: center;
    gap: 4px;
    min-height: 0;
    text-align: center;
  }

  .label {
    color: var(--muted);
    font-size: 0.85rem;
  }

  h2 {
    font-size: 1.9rem;
  }

  .arena {
    color: var(--gold);
    font-family: var(--font-display);
  }

  .boss {
    display: grid;
    grid-template-columns: 34% 1fr;
    gap: 12px;
    align-items: center;
    margin-top: 10px;
    padding: 10px;
    border-radius: var(--radius);
    background: var(--surface);
    text-align: left;
  }

  .art {
    display: block;
  }

  .actions {
    display: grid;
    gap: 8px;
  }

  .hint {
    color: var(--muted);
    font-size: 0.85rem;
    text-align: center;
  }
</style>
