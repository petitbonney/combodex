<script lang="ts">
import type { Language } from '../../content/i18n/index.ts';
import { session } from '../logic/game.ts';
import { panel } from '../logic/panels.ts';
import { type AnimationSpeed, settings, type TextSize } from '../logic/settings.ts';
import { texts } from '../logic/texts.ts';
import Sheet from './Sheet.svelte';

const app = $derived($texts.text.app);
// Pas de sortie pendant une animation : elle reposerait l'état une fois finie.
const inRun = $derived($session.state !== null && !$session.busy);
let confirming = $state(false);

const close = () => panel.set(null);

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
];

const speeds = $derived<{ value: AnimationSpeed; label: string }[]>([
  { value: 'normal', label: app.speedNormal },
  { value: 'fast', label: app.speedFast },
  { value: 'instant', label: app.speedInstant },
]);

const sizes = $derived<{ value: TextSize; label: string }[]>([
  { value: 'normal', label: app.textNormal },
  { value: 'large', label: app.textLarge },
]);

function toTitle(): void {
  close();
  session.leave();
}

async function abandon(): Promise<void> {
  close();
  await session.abandon();
}
</script>

{#snippet choice<T>(
  label: string,
  options: { value: T; label: string }[],
  current: T,
  pick: (value: T) => void,
)}
  <fieldset>
    <legend>{label}</legend>
    <div class="options">
      {#each options as option (option.value)}
        <button
          class="btn"
          class:primary={option.value === current}
          type="button"
          aria-pressed={option.value === current}
          onclick={() => pick(option.value)}
        >
          {option.label}
        </button>
      {/each}
    </div>
  </fieldset>
{/snippet}

<Sheet title={app.settings} onClose={close}>
  <div class="settings">
    {@render choice(app.language, LANGUAGES, $settings.language, (language) =>
      settings.update((value) => ({ ...value, language })),
    )}
    {@render choice(app.animationSpeed, speeds, $settings.speed, (speed) =>
      settings.update((value) => ({ ...value, speed })),
    )}
    {@render choice(app.textSize, sizes, $settings.textSize, (textSize) =>
      settings.update((value) => ({ ...value, textSize })),
    )}
    <div class="links">
      <button class="btn" type="button" onclick={() => panel.set('help')}>{app.howToPlay}</button>
      <button class="btn" type="button" onclick={() => panel.set('about')}>{app.about}</button>
    </div>
    {#if inRun}
      <div class="links">
        <button class="btn" type="button" onclick={toTitle}>{app.backToTitle}</button>
        {#if confirming}
          <p>{app.abandonConfirm}</p>
          <button class="btn danger" type="button" onclick={abandon}>{app.abandonYes}</button>
          <button class="btn" type="button" onclick={() => (confirming = false)}>
            {app.abandonNo}
          </button>
        {:else}
          <button class="btn danger" type="button" onclick={() => (confirming = true)}>
            {app.abandonRun}
          </button>
        {/if}
      </div>
    {/if}
  </div>
</Sheet>

<style>
  .settings,
  .links {
    display: grid;
    gap: 12px;
  }

  .links {
    gap: 8px;
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    margin-bottom: 6px;
    padding: 0;
    color: var(--muted);
  }

  .options {
    display: grid;
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
    gap: 6px;
  }

  .options .btn {
    padding: 0 6px;
  }
</style>
