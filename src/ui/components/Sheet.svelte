<script lang="ts">
import X from '@lucide/svelte/icons/x';
import type { Snippet } from 'svelte';
import { texts } from '../logic/texts.ts';

interface Props {
  title: string;
  onClose?: (() => void) | undefined;
  children: Snippet;
  actions?: Snippet | undefined;
}

const { title, onClose, children, actions }: Props = $props();

let dialog: HTMLDialogElement;

$effect(() => {
  dialog.showModal();
  return () => dialog.close();
});

function onBackdrop(event: MouseEvent): void {
  if (event.target === dialog) onClose?.();
}
</script>

<dialog
  bind:this={dialog}
  aria-label={title}
  onclick={onBackdrop}
  oncancel={(event) => {
    event.preventDefault();
    onClose?.();
  }}
>
  <div class="panel">
    <header>
      <h2>{title}</h2>
      {#if onClose}
        <button class="icon-btn" type="button" aria-label={$texts.text.app.close} onclick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      {/if}
    </header>
    <div class="body">{@render children()}</div>
    {#if actions}<footer>{@render actions()}</footer>{/if}
  </div>
</dialog>

<style>
  dialog {
    width: 100%;
    max-width: 520px;
    max-height: 100dvh;
    margin: auto auto 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
  }

  dialog::backdrop {
    background: rgb(4 6 14 / 72%);
  }

  .panel {
    display: flex;
    flex-direction: column;
    max-height: 92dvh;
    border: 1px solid var(--line);
    border-bottom: 0;
    border-radius: 18px 18px 0 0;
    background: var(--bg-raised);
    animation: rise 200ms ease-out;
    padding-bottom: var(--safe-bottom);
  }

  @media (min-width: 620px) {
    dialog {
      margin: auto;
    }

    .panel {
      border-bottom: 1px solid var(--line);
      border-radius: 18px;
    }
  }

  @keyframes rise {
    from {
      translate: 0 28px;
      opacity: 0;
    }
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px 6px 16px;
  }

  h2 {
    font-size: 1.2rem;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 16px 14px;
    overscroll-behavior: contain;
  }

  footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 16px 14px;
    border-top: 1px solid var(--line);
  }
</style>
