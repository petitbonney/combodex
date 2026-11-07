<script lang="ts">
import type { Snippet } from 'svelte';
import type { CardData, PokemonType, Variant } from '../../engine/index.ts';
import { texts } from '../logic/texts.ts';
import GameCard from './GameCard.svelte';
import Sheet from './Sheet.svelte';
import TypeIcon from './TypeIcon.svelte';

interface Props {
  card: CardData;
  variant?: Variant;
  energies?: readonly PokemonType[];
  maskDamage?: boolean;
  onClose: () => void;
  actions?: Snippet | undefined;
}

const {
  card,
  variant = 'normal',
  energies = [],
  maskDamage = false,
  onClose,
  actions,
}: Props = $props();

const app = $derived($texts.text.app);
const family = $derived(card.abilityFamily ? $texts.text.families[card.abilityFamily] : null);
</script>

<Sheet title={card.name[$texts.language]} {onClose} {actions}>
  <div class="detail">
    <div class="art">
      <GameCard {card} {variant} quality="high" plain />
    </div>
    <dl>
      <div>
        <dt>{app.stage}</dt>
        <dd>
          {#each card.types as type (type)}<TypeIcon {type} size={18} />{/each}
          {$texts.text.stages[card.stage]}
        </dd>
      </div>
      <div><dt>{app.damageStat}</dt><dd>{maskDamage ? '?' : card.bestDamage}</dd></div>
      <div><dt>{app.hp}</dt><dd>{card.hp}</dd></div>
      <div><dt>{app.retreatStat}</dt><dd>{card.retreat}</dd></div>
      {#if variant !== 'normal'}
        <div><dt>{app.variant}</dt><dd>{$texts.text.variants[variant]}</dd></div>
      {/if}
      {#if energies.length > 0}
        <div>
          <dt>{app.energies}</dt>
          <dd>{#each energies as energy, position (position)}<TypeIcon type={energy} size={18} />{/each}</dd>
        </div>
      {/if}
    </dl>
    {#if family}
      <p class="talent"><strong>{app.talent} · {family.name}</strong><br />{family.effect}</p>
    {/if}
  </div>
</Sheet>

<style>
  .detail {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }

  .art {
    width: min(100%, 38dvh);
  }

  dl {
    display: grid;
    gap: 8px;
    margin: 0;
  }

  dt {
    color: var(--muted);
    font-size: 0.8rem;
  }

  dd {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin: 0;
    font-family: var(--font-display);
    font-weight: 500;
  }

  .talent {
    grid-column: 1 / -1;
    padding: 10px 12px;
    border-radius: var(--radius-small);
    background: var(--surface);
    font-size: 0.95rem;
  }
</style>
