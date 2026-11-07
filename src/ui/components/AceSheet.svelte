<script lang="ts">
import { ACE_SPECS } from '../../content/consumables.ts';
import type { CardInstance, RunState } from '../../engine/index.ts';
import { session } from '../logic/game.ts';
import { texts } from '../logic/texts.ts';
import { showToast } from '../logic/toasts.ts';
import DeckSheet from './DeckSheet.svelte';
import Sheet from './Sheet.svelte';

interface Props {
  run: RunState;
  onClose: () => void;
}

const { run, onClose }: Props = $props();

const text = $derived($texts.text);
const app = $derived(text.app);
const id = $derived(run.aceSpec);
const def = $derived(id ? ACE_SPECS[id] : null);
const timing = $derived.by(() => {
  if (def?.timing === 'fight') return app.aceInFight;
  if (def?.timing === 'outsideFight') return app.aceOutsideFight;
  return null;
});

let picking = $state(false);

async function use(targets: readonly CardInstance[] = []): Promise<void> {
  const targetUids = targets.map((card) => card.uid);
  onClose();
  const refusal = await session.dispatch({ type: 'useAce', targetUids });
  if (refusal) showToast(text.illegal[refusal]);
}

function start(): void {
  if (def && def.targets > 0) picking = true;
  else void use();
}
</script>

{#if picking && def}
  <DeckSheet
    {run}
    title={app.pickTargets(def.targets)}
    pickCount={def.targets}
    onPickMany={use}
    onClose={() => (picking = false)}
  />
{:else if id}
  <Sheet title={text.aces[id].name} {onClose} {actions}>
    <p class="tag">{app.aceTag}</p>
    <p>{text.aces[id].effect}</p>
    {#if timing}<p class="tag">{timing}</p>{/if}
  </Sheet>
{/if}

{#snippet actions()}
  <button class="btn primary" type="button" onclick={start}>{app.aceUse}</button>
{/snippet}

<style>
  .tag {
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
