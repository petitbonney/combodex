<script lang="ts">
import Crown from '@lucide/svelte/icons/crown';
import Swords from '@lucide/svelte/icons/swords';
import Trophy from '@lucide/svelte/icons/trophy';
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

const gymCount = $derived(run.arenas.filter((stop) => !stop.league).length);

const STAGES = ['trainer', 'elite', 'champion'] as const;
const STAGE_ICONS = [User, Swords, Crown];

const text = $derived($texts.text);
const app = $derived(text.app);
const arena = $derived(currentArena(run));
const league = $derived(arena.league === true);
const kind = $derived(league ? 'league' : (STAGES[run.stageIndex] ?? 'trainer'));
const isChampion = $derived(kind === 'champion' || kind === 'league');
const champion = $derived(
  cardOf(cardIndex, { uid: -1, cardId: arena.championCardId, variant: 'normal', energies: [] }),
);
const effect = $derived.by(() => {
  if (league) return app.leagueRules;
  return arena.form === 'permanent' ? text.permanents[arena.type] : app.championStatuses;
});
</script>

<main class="screen">
  <TopBar
    title={league ? app.leagueTitle : app.arenaProgress(run.arenaIndex + 1, gymCount)}
    money={run.money}
    deckSize={run.deck.length}
  />

  <ol class="map">
    {#each run.arenas as stop, position (position)}
      <li class:current={position === run.arenaIndex} class:done={position < run.arenaIndex}>
        {#if stop.league}
          <Trophy size={20} aria-hidden="true" />
          <span class="sr-only">{app.leagueTitle}</span>
        {:else}
          <TypeIcon type={stop.type} size={20} />
        {/if}
        <span class="steps">
          {#each stop.league ? [] : STAGES as stage, step (stage)}
            {@const StepIcon = STAGE_ICONS[step] as typeof User}
            <span
              class="step"
              class:reached={position < run.arenaIndex ||
                (position === run.arenaIndex && step < run.stageIndex)}
              class:next={position === run.arenaIndex && step === run.stageIndex}
              title={text.opponents[stage]}
            >
              <StepIcon size={10} aria-hidden="true" />
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
    {#if !league}
      <p class="arena">{app.arenaTitle(run.arenaIndex + 1, text.types[arena.type])}</p>
    {/if}
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
    grid-template-columns: repeat(auto-fit, minmax(58px, 1fr));
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    gap: 3px;
    justify-items: center;
    padding: 4px 2px;
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
    gap: 2px;
  }

  .step {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
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
