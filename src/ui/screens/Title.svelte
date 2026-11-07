<script lang="ts">
import Info from '@lucide/svelte/icons/info';
import Settings from '@lucide/svelte/icons/settings';
import { onMount } from 'svelte';
import { STARTING_SET } from '../../content/sets.ts';
import {
  decodeRunCode,
  lockedTools,
  type RunState,
  seedFromText,
} from '../../engine/index.ts';
import { progress, session } from '../logic/game.ts';
import { menuScreen, panel } from '../logic/panels.ts';
import { texts } from '../logic/texts.ts';
import { showToast } from '../logic/toasts.ts';

const app = $derived($texts.text.app);
// Sans proxy : l'état repart tel quel dans le moteur, qui le clone.
let saved = $state.raw<RunState | null>(null);
let seedText = $state('');

onMount(() => {
  void session
    .flush()
    .then(() => session.savedRun())
    .then((run) => {
      saved = run;
    });
});

/** Un code rejoue une run à l'identique ; un texte libre donne une graine sur la première extension. */
function startFromCode(): void {
  const text = seedText.trim();
  if (!text) return;
  const code = decodeRunCode(text);
  if (code) {
    session.newRun(code);
    return;
  }
  if (text.includes('-')) {
    showToast(app.invalidCode);
    return;
  }
  const seed = /^\d+$/.test(text) ? Number(text) : seedFromText(text);
  session.newRun({ setId: STARTING_SET, seed, lockedTools: lockedTools(progress.current) });
}
</script>

<main class="screen title">
  <div class="top">
    <button class="icon-btn" type="button" aria-label={app.about} onclick={() => panel.set('about')}>
      <Info size={20} aria-hidden="true" />
    </button>
    <button class="icon-btn" type="button" aria-label={app.settings} onclick={() => panel.set('settings')}>
      <Settings size={20} aria-hidden="true" />
    </button>
  </div>

  <div class="hero">
    <h1>Combodex</h1>
    <p>{app.tagline}</p>
  </div>

  <div class="menu">
    {#if saved}
      <button class="btn primary" type="button" onclick={() => saved && session.resume(saved)}>
        {app.continueRun}
      </button>
    {/if}
    <button class="btn" class:primary={!saved} type="button" onclick={() => menuScreen.set('setup')}>
      {app.newRun}
    </button>
    <button class="btn" type="button" onclick={() => panel.set('daily')}>{app.daily}</button>
    <button class="btn" type="button" onclick={() => menuScreen.set('binder')}>{app.binder}</button>
    <button class="btn" type="button" onclick={() => panel.set('help')}>{app.howToPlay}</button>
    <details>
      <summary>{app.seedLabel}</summary>
      <label>
        <span class="sr-only">{app.seedLabel}</span>
        <input bind:value={seedText} autocomplete="off" inputmode="text" maxlength="32" />
      </label>
      <p class="hint">{app.seedHint}</p>
      <button class="btn code" type="button" disabled={!seedText.trim()} onclick={startFromCode}>
        {app.startRun}
      </button>
    </details>
  </div>

  <p class="legal">{app.aboutLegal}</p>
</main>

<style>
  .title {
    justify-content: space-between;
  }

  .top {
    display: flex;
    justify-content: space-between;
  }

  .hero {
    display: grid;
    gap: 6px;
    justify-items: center;
    text-align: center;
  }

  h1 {
    background: var(--foil);
    background-clip: text;
    color: transparent;
    font-size: clamp(2.8rem, 15vw, 4.4rem);
  }

  .hero p {
    color: var(--muted);
  }

  .menu {
    display: grid;
    gap: 10px;
    width: min(100%, 320px);
    margin: 0 auto;
  }

  details {
    color: var(--muted);
    font-size: 0.92rem;
  }

  summary {
    min-height: 32px;
    cursor: pointer;
  }

  input {
    width: 100%;
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius-small);
    background: var(--surface);
    font-size: 1rem;
  }

  .hint {
    margin-top: 4px;
    font-size: 0.82rem;
  }

  .code {
    width: 100%;
    margin-top: 6px;
  }

  .legal {
    color: var(--muted);
    font-size: 0.75rem;
    text-align: center;
  }
</style>
