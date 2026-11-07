<script lang="ts">
import Armchair from '@lucide/svelte/icons/armchair';
import Backpack from '@lucide/svelte/icons/backpack';
import Bed from '@lucide/svelte/icons/bed';
import BookOpen from '@lucide/svelte/icons/book-open';
import Crosshair from '@lucide/svelte/icons/crosshair';
import Dumbbell from '@lucide/svelte/icons/dumbbell';
import Gem from '@lucide/svelte/icons/gem';
import GitFork from '@lucide/svelte/icons/git-fork';
import Library from '@lucide/svelte/icons/library';
import Medal from '@lucide/svelte/icons/medal';
import Paintbrush from '@lucide/svelte/icons/paintbrush';
import Palette from '@lucide/svelte/icons/palette';
import PiggyBank from '@lucide/svelte/icons/piggy-bank';
import Sandwich from '@lucide/svelte/icons/sandwich';
import Shield from '@lucide/svelte/icons/shield';
import Sprout from '@lucide/svelte/icons/sprout';
import Tag from '@lucide/svelte/icons/tag';
import Tent from '@lucide/svelte/icons/tent';
import Users from '@lucide/svelte/icons/users';
import Weight from '@lucide/svelte/icons/weight';
import type { ToolId } from '../../content/tools.ts';

interface Props {
  toolId: ToolId;
  size?: number;
}

const { toolId, size = 22 }: Props = $props();

const ICONS: Record<ToolId, typeof Tent> = {
  campfire: Tent,
  picnic: Sandwich,
  lightBag: Backpack,
  colossus: Shield,
  counterType: Crosshair,
  prism: Gem,
  familyTree: GitFork,
  rigidBinder: Library,
  pokedex: BookOpen,
  training: Dumbbell,
  favoriteArtist: Paintbrush,
  bigBench: Armchair,
  marketValue: Tag,
  piggyBank: PiggyBank,
  nap: Bed,
  duo: Users,
  evolutionStone: Sprout,
  heavyweight: Weight,
  palette: Palette,
  badgeCase: Medal,
};

const Icon = $derived(ICONS[toolId]);
</script>

<Icon {size} strokeWidth={2} aria-hidden="true" />
