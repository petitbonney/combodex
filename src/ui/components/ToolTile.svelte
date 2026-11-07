<script lang="ts">
import type { ToolId } from '../../content/tools.ts';
import type { PokemonType } from '../../engine/index.ts';
import ToolIcon from './ToolIcon.svelte';
import TypeIcon from './TypeIcon.svelte';

interface Props {
  toolId: ToolId;
  type: PokemonType | null;
  disabled?: boolean;
  lit?: boolean;
}

const { toolId, type, disabled = false, lit = false }: Props = $props();
</script>

<span class="tile" class:disabled class:lit>
  <ToolIcon {toolId} />
  {#if type}<span class="badge"><TypeIcon {type} size={15} /></span>{/if}
</span>

<style>
  .tile {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    border: 1px solid var(--line);
    border-radius: var(--radius-small);
    background: linear-gradient(160deg, var(--surface-strong), var(--surface));
    color: var(--gold);
    transition:
      scale 140ms ease,
      box-shadow 140ms ease;
  }

  .tile.disabled {
    color: var(--muted);
    opacity: 0.55;
    background: repeating-linear-gradient(45deg, var(--surface) 0 6px, var(--bg-raised) 6px 12px);
  }

  .tile.lit {
    scale: 1.14;
    box-shadow:
      0 0 0 2px var(--gold),
      0 0 18px rgb(255 201 77 / 60%);
  }

  .badge {
    position: absolute;
    right: 2px;
    bottom: 2px;
    display: inline-flex;
  }
</style>
