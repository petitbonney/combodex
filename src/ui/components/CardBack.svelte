<script lang="ts">
import X from '@lucide/svelte/icons/x';
</script>

<div class="back" aria-hidden="true">
  <span class="mark"><X size="55%" strokeWidth={3} /></span>
</div>

<style>
  .back {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    border: 3px solid transparent;
    border-radius: 6%/4.4%;
    background:
      repeating-linear-gradient(45deg, rgb(255 255 255 / 5%) 0 6px, transparent 6px 12px) padding-box,
      linear-gradient(160deg, #1b2448, #101631) padding-box,
      var(--foil) border-box;
  }

  .mark {
    display: grid;
    place-items: center;
    width: 46%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: rgb(0 0 0 / 28%);
    color: var(--gold);
  }
</style>
