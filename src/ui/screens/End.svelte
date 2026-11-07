<script lang="ts">
import Skull from '@lucide/svelte/icons/skull';
import Trophy from '@lucide/svelte/icons/trophy';
import Copy from '@lucide/svelte/icons/copy';
import { type ComboId, encodeRunCode, lockedTools, type RunState } from '../../engine/index.ts';
import { formatNumber } from '../logic/format.ts';
import { progress, session } from '../logic/game.ts';
import { menuScreen } from '../logic/panels.ts';
import { texts } from '../logic/texts.ts';
import { showToast } from '../logic/toasts.ts';

interface Props {
  run: RunState;
}

const { run }: Props = $props();

const text = $derived($texts.text);
const app = $derived(text.app);
const language = $derived($texts.language);
const won = $derived(run.phase === 'won');

const favorite = $derived.by(() => {
  const entries = Object.entries(run.stats.comboCounts) as [ComboId, number][];
  return entries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
});

const code = $derived(encodeRunCode(run));
const shareText = $derived(
  run.dailyDate
    ? app.dailyShare(run.dailyDate, formatNumber(run.stats.bestHand, language), code)
    : code,
);

/** Même extension et même type de deck, sur une nouvelle graine. */
function again(): void {
  session.newRun({
    setId: run.setId,
    seed: Date.now() % 2147483647,
    lockedTools: lockedTools(progress.current),
    starterLines: run.starterLines,
  });
}

function toTitle(): void {
  menuScreen.set('title');
  session.leave();
}

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(shareText);
    showToast(app.copied);
  } catch {
    showToast(app.copyFailed);
  }
}
</script>

<main class="screen end">
  <div class="hero" class:won>
    {#if won}<Trophy size={56} aria-hidden="true" />{:else}<Skull size={56} aria-hidden="true" />{/if}
    <h1>{won ? app.runWon : app.runLost}</h1>
  </div>
  <dl>
    <div><dt>{app.statFights}</dt><dd>{run.stats.fightsWon}</dd></div>
    <div><dt>{app.statBestHand}</dt><dd>{formatNumber(run.stats.bestHand, language)}</dd></div>
    <div><dt>{app.statHands}</dt><dd>{run.stats.handsPlayed}</dd></div>
    {#if favorite}
      <div><dt>{app.statFavorite}</dt><dd>{text.combos[favorite]}</dd></div>
    {/if}
    <div><dt>{app.statCode}</dt><dd>{code}</dd></div>
  </dl>
  {#if run.dailyDate}<p class="daily">{app.dailyTag(run.dailyDate)}</p>{/if}
  <div class="actions">
    <button class="btn primary" type="button" onclick={again}>{app.playAgain}</button>
    <button class="btn" type="button" onclick={copy}>
      <Copy size={16} aria-hidden="true" />{app.copyCode}
    </button>
    <button class="btn" type="button" onclick={toTitle}>{app.toTitle}</button>
  </div>
</main>

<style>
  .end {
    justify-content: center;
    gap: 22px;
  }

  .hero {
    display: grid;
    gap: 8px;
    justify-items: center;
    color: var(--bad);
  }

  .hero.won {
    color: var(--gold);
  }

  h1 {
    font-size: 2.2rem;
    text-align: center;
  }

  dl {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 12px 14px;
    border-radius: var(--radius);
    background: var(--surface);
  }

  dl div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 500;
  }

  .daily {
    color: var(--gold);
    font-family: var(--font-display);
    text-align: center;
  }

  .actions {
    display: grid;
    gap: 8px;
  }
</style>
