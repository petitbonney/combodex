<script lang="ts">
import AboutSheet from './components/AboutSheet.svelte';
import DeckSheet from './components/DeckSheet.svelte';
import HelpSheet from './components/HelpSheet.svelte';
import SettingsSheet from './components/SettingsSheet.svelte';
import Toasts from './components/Toasts.svelte';
import { session } from './logic/game.ts';
import { panel } from './logic/panels.ts';
import { settings } from './logic/settings.ts';
import { texts } from './logic/texts.ts';
import { showToast } from './logic/toasts.ts';
import Booster from './screens/Booster.svelte';
import End from './screens/End.svelte';
import Fight from './screens/Fight.svelte';
import Intro from './screens/Intro.svelte';
import Shop from './screens/Shop.svelte';
import Title from './screens/Title.svelte';

const run = $derived($session.state);

$effect(() => {
  document.documentElement.lang = $settings.language;
  document.documentElement.dataset.textSize = $settings.textSize;
});

$effect(() => {
  if ($session.saveFailed) showToast($texts.text.app.saveFailed);
});
</script>

{#if !run}
  <Title />
{:else if run.phase === 'intro'}
  <Intro {run} />
{:else if run.phase === 'fight' && run.fight}
  <Fight {run} fight={run.fight} />
{:else if run.phase === 'shop' && run.shop}
  <Shop {run} shop={run.shop} />
{:else if run.phase === 'booster' && run.booster}
  <Booster {run} booster={run.booster} />
{:else}
  <End {run} />
{/if}

{#if $panel === 'settings'}<SettingsSheet />{/if}
{#if $panel === 'help'}<HelpSheet />{/if}
{#if $panel === 'about'}<AboutSheet />{/if}
{#if $panel === 'deck' && run}<DeckSheet {run} onClose={() => panel.set(null)} />{/if}

<Toasts />
