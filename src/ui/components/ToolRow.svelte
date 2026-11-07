<script lang="ts">
import type { ToolInstance } from '../../content/tools.ts';
import { pressable } from '../actions/pressable.ts';
import { toolLabel } from '../logic/labels.ts';
import { texts } from '../logic/texts.ts';
import ToolTile from './ToolTile.svelte';

interface Props {
  tools: readonly ToolInstance[];
  /** Emplacements de la run. */
  slots: number;
  disabledUids?: readonly number[];
  litUid?: number | null;
  popup?: string | null;
  locked?: boolean;
  onOpen: (tool: ToolInstance) => void;
  onReorder: (uids: number[]) => void;
}

const {
  tools,
  slots,
  disabledUids = [],
  litUid = null,
  popup = null,
  locked = false,
  onOpen,
  onReorder,
}: Props = $props();

const app = $derived($texts.text.app);
const empty = $derived(Math.max(0, slots - tools.length));

function find(id: string): ToolInstance | undefined {
  return tools.find((tool) => String(tool.uid) === id);
}

function reorder(from: number, to: number): void {
  const uids = tools.map((tool) => tool.uid);
  const [moved] = uids.splice(from, 1);
  if (moved === undefined) return;
  uids.splice(to, 0, moved);
  onReorder(uids);
}
</script>

<div
  class="row"
  style:--slots={Math.max(slots, tools.length)}
  use:pressable={{
    disabled: locked,
    onReorder: reorder,
    onLongPress: (id) => {
      const tool = find(id);
      if (tool) onOpen(tool);
    },
  }}
>
  {#each tools as tool, position (tool.uid)}
    <button
      class="slot"
      type="button"
      data-press-id={tool.uid}
      aria-label={app.toolSlotLabel(position + 1, toolLabel($texts.text, tool))}
      onclick={() => onOpen(tool)}
    >
      <ToolTile
        toolId={tool.toolId}
        type={tool.type}
        disabled={disabledUids.includes(tool.uid)}
        lit={litUid === tool.uid}
      />
      {#if litUid === tool.uid && popup}<span class="pop">{popup}</span>{/if}
    </button>
  {/each}
  {#each { length: empty } as _, position (position)}
    <span class="slot empty" aria-label={app.emptyToolSlot} role="img"></span>
  {/each}
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: repeat(var(--slots), minmax(0, 1fr));
    gap: 6px;
    touch-action: none;
  }

  .slot {
    position: relative;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-small);
    background: none;
    transition: translate 140ms ease;
  }

  .empty {
    border: 1px dashed var(--line);
  }

  .pop {
    position: absolute;
    z-index: 5;
    bottom: 100%;
    left: 50%;
    padding: 2px 7px;
    border-radius: 7px;
    background: var(--mult);
    color: var(--mult-ink);
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
    translate: -50% 0;
    animation: float-up 420ms ease-out;
  }

  @keyframes float-up {
    from {
      translate: -50% 10px;
      opacity: 0;
    }
  }
</style>
