<script lang="ts">
import Lock from '@lucide/svelte/icons/lock';
import Sparkle from '@lucide/svelte/icons/sparkle';
import TriangleAlert from '@lucide/svelte/icons/triangle-exclamation-point';
import type { CardData, PokemonType, Variant } from '../../engine/index.ts';
import { imageOf } from '../logic/game.ts';
import type { ImageQuality } from '../logic/images.ts';
import { texts } from '../logic/texts.ts';
import CardBack from './CardBack.svelte';
import TypeIcon from './TypeIcon.svelte';

interface Props {
  card: CardData;
  variant?: Variant;
  energies?: readonly PokemonType[];
  hidden?: boolean;
  maskDamage?: boolean;
  paralyzed?: boolean;
  forced?: boolean;
  quality?: ImageQuality;
  /** Sans badges : la carte seule, pour le zoom. */
  plain?: boolean;
}

const {
  card,
  variant = 'normal',
  energies = [],
  hidden = false,
  maskDamage = false,
  paralyzed = false,
  forced = false,
  quality = 'low',
  plain = false,
}: Props = $props();

const preferred = $derived(imageOf(card, quality, $texts.language));
const otherLanguage = $derived($texts.language === 'fr' ? 'en' : 'fr');
// TCGdex n'a pas tous les visuels dans les deux langues.
let failedSource = $state('');
const source = $derived(
  failedSource === preferred ? imageOf(card, quality, otherLanguage) : preferred,
);
let loadedSource = $state('');
const mainType = $derived(card.types[0] ?? 'Colorless');
</script>

{#if hidden}
  <div class="card"><CardBack /></div>
{:else}
  <div
    class="card {variant}"
    class:paralyzed
    style:--type-color="var(--type-{mainType.toLowerCase()})"
  >
    <div class="fallback">
      <strong>{card.name[$texts.language]}</strong>
      <span>{card.hp} {$texts.text.app.hp}</span>
    </div>
    <img
      src={source}
      alt=""
      class:loaded={loadedSource === source}
      crossorigin="anonymous"
      decoding="async"
      draggable="false"
      onload={() => {
        loadedSource = source;
      }}
      onerror={() => {
        failedSource = preferred;
      }}
    />
    {#if variant !== 'normal'}<span class="foil"></span>{/if}
    {#if variant === 'firstEdition'}<span class="stamp">1</span>{/if}

    {#if !plain}
      <span class="badges">
        {#each card.types as type (type)}<TypeIcon {type} size={17} />{/each}
        {#each energies as energy, position (position)}
          <TypeIcon type={energy} size={14} />
        {/each}
        {#if card.abilityFamily}
          <span class="talent" title={$texts.text.families[card.abilityFamily].name}>
            <Sparkle size={11} strokeWidth={3} aria-hidden="true" />
          </span>
        {/if}
      </span>
      <span class="stats">
        <span class="retreat" aria-label={$texts.text.app.retreat}>{card.retreat}</span>
        <span class="damage">{maskDamage ? '?' : card.bestDamage}</span>
      </span>
      {#if paralyzed}
        <span class="state lock"><Lock size={18} aria-hidden="true" /></span>
      {/if}
      {#if forced}
        <span class="state forced"><TriangleAlert size={16} aria-hidden="true" /></span>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .card {
    position: relative;
    width: 100%;
    aspect-ratio: 245 / 337;
    overflow: hidden;
    border-radius: 6% / 4.4%;
    background: var(--surface);
    box-shadow: 0 3px 10px rgb(0 0 0 / 50%);
    -webkit-touch-callout: none;
    user-select: none;
  }

  .fallback {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 8% 7% 26%;
    border: 3px solid var(--type-color);
    border-radius: inherit;
    background: linear-gradient(170deg, color-mix(in srgb, var(--type-color) 40%, var(--surface)), var(--surface));
    font-size: 0.75rem;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 200ms ease;
    pointer-events: none;
  }

  img.loaded {
    opacity: 1;
  }

  .foil {
    position: absolute;
    inset: 0;
    pointer-events: none;
    mix-blend-mode: color-dodge;
  }

  .holo .foil {
    background:
      repeating-linear-gradient(110deg, rgb(255 0 120 / 22%) 0 8%, rgb(0 220 255 / 22%) 8% 16%, rgb(255 230 0 / 22%) 16% 24%),
      linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 45%) 50%, transparent 70%);
    background-size:
      220% 220%,
      250% 250%;
    animation: shimmer 5s linear infinite;
  }

  .reverse .foil {
    background:
      radial-gradient(circle at 30% 20%, rgb(255 255 255 / 20%), transparent 40%),
      linear-gradient(115deg, transparent 35%, rgb(160 220 255 / 40%) 50%, transparent 65%);
    background-size:
      100% 100%,
      260% 260%;
    animation: shimmer 7s linear infinite;
  }

  .firstEdition .foil {
    background: linear-gradient(115deg, transparent 30%, rgb(255 210 110 / 50%) 50%, transparent 70%);
    background-size: 260% 260%;
    animation: shimmer 6s linear infinite;
  }

  @keyframes shimmer {
    from {
      background-position:
        0% 0%,
        120% 0%;
    }

    to {
      background-position:
        220% 100%,
        -120% 100%;
    }
  }

  .stamp {
    position: absolute;
    top: 40%;
    left: 6%;
    display: grid;
    place-items: center;
    width: 22%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--gold);
    color: var(--gold-ink);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.75rem;
  }

  /* Dans l'éventail, seule la gauche de chaque carte reste visible. */
  .badges {
    position: absolute;
    top: 3%;
    left: 4%;
    display: flex;
    flex-direction: column;
    gap: 1px;
    align-items: center;
  }

  .talent {
    display: grid;
    place-items: center;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    background: var(--gold);
    color: var(--gold-ink);
  }

  .stats {
    position: absolute;
    bottom: 3%;
    left: 3%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: flex-start;
    font-family: var(--font-display);
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1;
  }

  .stats span {
    padding: 3px 5px;
    border-radius: 6px;
  }

  .damage {
    background: var(--damage);
    color: var(--damage-ink);
  }

  .retreat {
    background: rgb(10 14 28 / 88%);
    color: var(--text);
  }

  .state {
    position: absolute;
    top: 34%;
    left: 50%;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    translate: -50% 0;
  }

  .lock {
    background: rgb(10 14 28 / 88%);
    color: var(--type-lightning);
  }

  .forced {
    background: var(--gold);
    color: var(--gold-ink);
  }

  .paralyzed img {
    filter: grayscale(0.7) brightness(0.7);
  }
</style>
