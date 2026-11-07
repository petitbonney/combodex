<script lang="ts">
import { dailyChallenge, dailyDate } from '../../engine/index.ts';
import { LOCKABLE_TOOLS } from '../../content/objectives.ts';
import { indexOfSet } from '../logic/data.ts';
import { formatNumber } from '../logic/format.ts';
import { progress, session } from '../logic/game.ts';
import { panel } from '../logic/panels.ts';
import { texts } from '../logic/texts.ts';
import Sheet from './Sheet.svelte';

const app = $derived($texts.text.app);
const language = $derived($texts.language);
const challenge = dailyChallenge(dailyDate(Date.now()));
const best = $derived($progress.daily[challenge.date]);

/** Tous les joueurs ont la même boutique : les Outils à débloquer en restent absents. */
function play(): void {
  panel.set(null);
  session.newRun({
    setId: challenge.setId,
    seed: challenge.seed,
    lockedTools: LOCKABLE_TOOLS,
    dailyDate: challenge.date,
  });
}
</script>

<Sheet title={app.daily} onClose={() => panel.set(null)} {actions}>
  <div class="daily">
    <p class="date">{challenge.date}</p>
    <p>{app.dailySet(indexOfSet(challenge.setId).set.name[language])}</p>
    <p class="best">
      {best === undefined ? app.dailyNoScore : app.dailyBest(formatNumber(best, language))}
    </p>
    <p class="hint">{app.dailyHint}</p>
  </div>
</Sheet>

{#snippet actions()}
  <button class="btn primary" type="button" onclick={play}>{app.dailyPlay}</button>
{/snippet}

<style>
  .daily {
    display: grid;
    gap: 8px;
  }

  .date {
    color: var(--muted);
    font-size: 0.9rem;
  }

  .best {
    color: var(--gold);
    font-family: var(--font-display);
    font-size: 1.15rem;
  }

  .hint {
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
