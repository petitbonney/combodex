<script lang="ts">
import Layers from '@lucide/svelte/icons/layers';
import Settings from '@lucide/svelte/icons/settings';
import type { Snippet } from 'svelte';
import { panel } from '../logic/panels.ts';
import { texts } from '../logic/texts.ts';

interface Props {
  title: string;
  money: number;
  deckSize: number;
  extra?: Snippet;
}

const { title, money, deckSize, extra }: Props = $props();
const app = $derived($texts.text.app);
</script>

<header>
  <h1>{title}</h1>
  {@render extra?.()}
  <span class="money">{money} ₽</span>
  <button
    class="icon-btn deck"
    type="button"
    aria-label={app.deckTitle(deckSize)}
    onclick={() => panel.set('deck')}
  >
    <Layers size={18} aria-hidden="true" />
    <span>{deckSize}</span>
  </button>
  <button class="icon-btn" type="button" aria-label={app.menu} onclick={() => panel.set('settings')}>
    <Settings size={20} aria-hidden="true" />
  </button>
</header>

<style>
  header {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
  }

  h1 {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 1.25rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .deck {
    gap: 3px;
    width: auto;
    padding: 0 8px;
    font-family: var(--font-display);
    font-weight: 500;
  }
</style>
