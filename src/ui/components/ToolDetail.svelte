<script lang="ts">
import type { Snippet } from 'svelte';
import { TOOLS, type ToolId } from '../../content/tools.ts';
import type { PokemonType } from '../../engine/index.ts';
import { toolLabel } from '../logic/labels.ts';
import { texts } from '../logic/texts.ts';
import Sheet from './Sheet.svelte';
import ToolTile from './ToolTile.svelte';

interface Props {
  tool: { toolId: ToolId; type: PokemonType | null };
  disabled?: boolean;
  onClose: () => void;
  actions?: Snippet | undefined;
}

const { tool, disabled = false, onClose, actions }: Props = $props();
const text = $derived($texts.text);
</script>

<Sheet title={toolLabel(text, tool)} {onClose} {actions}>
  <div class="detail">
    <span class="tile"><ToolTile toolId={tool.toolId} type={tool.type} {disabled} /></span>
    <div>
      <p class="rarity">
        {text.toolRarities[TOOLS[tool.toolId].rarity]}{TOOLS[tool.toolId].stadium
          ? ` · ${text.app.stadiumTag}`
          : ''}
      </p>
      <p>{text.tools[tool.toolId].effect}</p>
      {#if disabled}<p class="off">{text.app.toolDisabled}</p>{/if}
    </div>
  </div>
</Sheet>

<style>
  .detail {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .tile {
    flex: none;
    width: 60px;
    height: 60px;
  }

  .rarity {
    color: var(--muted);
    font-size: 0.85rem;
  }

  .off {
    margin-top: 6px;
    color: var(--bad);
  }
</style>
