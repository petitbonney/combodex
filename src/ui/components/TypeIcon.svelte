<script lang="ts">
import Droplet from '@lucide/svelte/icons/droplet';
import Eye from '@lucide/svelte/icons/eye';
import Flame from '@lucide/svelte/icons/flame';
import HandFist from '@lucide/svelte/icons/hand-fist';
import Hexagon from '@lucide/svelte/icons/hexagon';
import Leaf from '@lucide/svelte/icons/leaf';
import Moon from '@lucide/svelte/icons/moon';
import Origami from '@lucide/svelte/icons/origami';
import Sparkles from '@lucide/svelte/icons/sparkles';
import Star from '@lucide/svelte/icons/star';
import Zap from '@lucide/svelte/icons/zap';
import type { PokemonType } from '../../engine/index.ts';
import { texts } from '../logic/texts.ts';

interface Props {
  type: PokemonType;
  size?: number;
}

const { type, size = 18 }: Props = $props();

const ICONS = {
  Grass: Leaf,
  Fire: Flame,
  Water: Droplet,
  Lightning: Zap,
  Psychic: Eye,
  Fighting: HandFist,
  Darkness: Moon,
  Metal: Hexagon,
  Fairy: Sparkles,
  Dragon: Origami,
  Colorless: Star,
} as const;

const Icon = $derived(ICONS[type]);
</script>

<span
  class="type"
  style:--size="{size}px"
  style:background="var(--type-{type.toLowerCase()})"
  role="img"
  aria-label={$texts.text.types[type]}
  title={$texts.text.types[type]}
>
  <Icon size={Math.round(size * 0.68)} strokeWidth={2.4} aria-hidden="true" />
</span>

<style>
  .type {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    color: var(--type-ink);
    box-shadow: 0 0 0 1px rgb(0 0 0 / 35%);
  }
</style>
