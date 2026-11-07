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
import Hammer from '@lucide/svelte/icons/hammer';
import Megaphone from '@lucide/svelte/icons/megaphone';
import Flag from '@lucide/svelte/icons/flag';
import User from '@lucide/svelte/icons/user';
import UsersRound from '@lucide/svelte/icons/users-round';
import Feather from '@lucide/svelte/icons/feather';
import Triangle from '@lucide/svelte/icons/triangle';
import Coins from '@lucide/svelte/icons/coins';
import Ticket from '@lucide/svelte/icons/ticket';
import Briefcase from '@lucide/svelte/icons/briefcase';
import SwatchBook from '@lucide/svelte/icons/swatch-book';
import Contrast from '@lucide/svelte/icons/contrast';
import TreePine from '@lucide/svelte/icons/tree-pine';
import Repeat from '@lucide/svelte/icons/repeat';
import BatteryCharging from '@lucide/svelte/icons/battery-charging';
import Mic from '@lucide/svelte/icons/mic';
import Search from '@lucide/svelte/icons/search';
import Pickaxe from '@lucide/svelte/icons/pickaxe';
import Landmark from '@lucide/svelte/icons/landmark';
import IdCard from '@lucide/svelte/icons/id-card';
import Scissors from '@lucide/svelte/icons/scissors';
import Trophy from '@lucide/svelte/icons/trophy';
import Swords from '@lucide/svelte/icons/swords';
import Skull from '@lucide/svelte/icons/skull';
import TrendingUp from '@lucide/svelte/icons/trending-up';
import Notebook from '@lucide/svelte/icons/notebook';
import Footprints from '@lucide/svelte/icons/footprints';
import Baby from '@lucide/svelte/icons/baby';
import Hourglass from '@lucide/svelte/icons/hourglass';
import Award from '@lucide/svelte/icons/award';
import FlagTriangleRight from '@lucide/svelte/icons/flag-triangle-right';
import Store from '@lucide/svelte/icons/store';
import Castle from '@lucide/svelte/icons/castle';
import Church from '@lucide/svelte/icons/church';
import Rainbow from '@lucide/svelte/icons/rainbow';
import Target from '@lucide/svelte/icons/target';
import Flower from '@lucide/svelte/icons/flower';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
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
  whetstone: Hammer,
  megaphone: Megaphone,
  lastStand: Flag,
  smallTeam: User,
  fullTeam: UsersRound,
  featherweight: Feather,
  trio: Triangle,
  goldNugget: Coins,
  coupon: Ticket,
  backpack: Briefcase,
  colorChart: SwatchBook,
  monochrome: Contrast,
  heritage: TreePine,
  reverseSleeve: Repeat,
  battery: BatteryCharging,
  talentShow: Mic,
  analysis: Search,
  armorPiercer: Pickaxe,
  savings: Landmark,
  loyaltyCard: IdCard,
  leanDeck: Scissors,
  grandSlam: Trophy,
  rivalry: Swords,
  finisher: Skull,
  growthCharm: TrendingUp,
  comboBook: Notebook,
  runningShoes: Footprints,
  rookie: Baby,
  hourglass: Hourglass,
  goldMedal: Award,
  trainingGround: FlagTriangleRight,
  marketSquare: Store,
  lineagePalace: Castle,
  typeTemple: Church,
  rainbowBridge: Rainbow,
  dojo: Target,
  greenhouse: Flower,
  sanctuary: ShieldCheck,
};

const Icon = $derived(ICONS[toolId]);
</script>

<Icon {size} strokeWidth={2} aria-hidden="true" />
