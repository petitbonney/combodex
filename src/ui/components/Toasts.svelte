<script lang="ts">
import { toasts } from '../logic/toasts.ts';
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each $toasts as toast (toast.id)}
    <p>{toast.text}</p>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    z-index: 60;
    top: calc(10px + var(--safe-top));
    right: 12px;
    left: 12px;
    display: grid;
    gap: 6px;
    justify-items: center;
    pointer-events: none;
  }

  p {
    max-width: 340px;
    padding: 8px 14px;
    border: 1px solid var(--gold);
    border-radius: 12px;
    background: rgb(12 16 34 / 96%);
    box-shadow: var(--shadow);
    text-align: center;
    animation: drop 160ms ease-out;
  }

  @keyframes drop {
    from {
      translate: 0 -10px;
      opacity: 0;
    }
  }
</style>
