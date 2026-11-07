<script lang="ts">
import type { BoosterKind } from '../../engine/index.ts';
import { cardIndex } from '../logic/data.ts';
import { texts } from '../logic/texts.ts';

interface Props {
  kind: BoosterKind;
  /** Le paquet se déchire. */
  tearing?: boolean;
}

const { kind, tearing = false }: Props = $props();

const GRADIENTS: Record<BoosterKind, string> = {
  set: 'linear-gradient(150deg, #3a58c9, #7d3fc4 55%, #d94b8c)',
  energy: 'linear-gradient(150deg, #0f9b8e, #2ecc71 55%, #f1c40f)',
  trainer: 'linear-gradient(150deg, #b5541c, #e08e2b 55%, #ffd166)',
  premium: 'linear-gradient(150deg, #1f1f27, #5a4a22 50%, #a8842e 80%, #e0b94f)',
};
</script>

<div class="pack" class:tearing style:--pack={GRADIENTS[kind]}>
  <span class="crimp top"></span>
  <span class="shine"></span>
  <span class="label">
    <small>{cardIndex.set.name[$texts.language]}</small>
    <strong>{$texts.text.app.boosterNames[kind]}</strong>
  </span>
  <span class="crimp bottom"></span>
</div>

<style>
  .pack {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 3 / 4.6;
    overflow: hidden;
    border-radius: 6px;
    background: var(--pack);
    box-shadow: var(--shadow);
    color: #fff;
    text-align: center;
  }

  .pack.tearing {
    animation: tear 420ms ease-in both;
  }

  @keyframes tear {
    30% {
      rotate: -3deg;
      scale: 1.05;
    }

    60% {
      rotate: 3deg;
    }

    to {
      scale: 1.3;
      opacity: 0;
    }
  }

  .crimp {
    position: absolute;
    right: 0;
    left: 0;
    height: 7%;
    background: repeating-linear-gradient(90deg, rgb(255 255 255 / 30%) 0 3px, rgb(0 0 0 / 20%) 3px 6px);
  }

  .top {
    top: 0;
  }

  .bottom {
    bottom: 0;
  }

  .shine {
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 35%, rgb(255 255 255 / 35%) 50%, transparent 65%);
    background-size: 260% 260%;
    animation: sweep 4s linear infinite;
  }

  @keyframes sweep {
    from {
      background-position: 130% 0;
    }

    to {
      background-position: -130% 100%;
    }
  }

  .label {
    position: relative;
    display: grid;
    gap: 2px;
    padding: 6px;
    text-shadow: 0 1px 4px rgb(0 0 0 / 75%);
  }

  small {
    font-size: 0.75rem;
  }

  strong {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.1;
  }
</style>
