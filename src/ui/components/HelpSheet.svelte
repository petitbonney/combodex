<script lang="ts">
import { COMBO_IDS, COMBO_VALUES } from '../../engine/index.ts';
import { panel } from '../logic/panels.ts';
import { texts } from '../logic/texts.ts';
import Sheet from './Sheet.svelte';

const text = $derived($texts.text);
const app = $derived(text.app);
</script>

<Sheet title={app.howToPlay} onClose={() => panel.set(null)}>
  <div class="help">
    <section>
      <h3>{app.helpGoalTitle}</h3>
      <p>{app.helpGoal}</p>
      <p>{app.helpFormula}</p>
    </section>
    <section>
      <h3>{app.helpGesturesTitle}</h3>
      <p>{app.helpGestures}</p>
    </section>
    <section>
      <h3>{app.helpKeyboardTitle}</h3>
      <p>{app.helpKeyboard}</p>
    </section>
    <section>
      <h3>{app.helpCombosTitle}</h3>
      <p class="hint">{app.helpCombos}</p>
      <ul>
        {#each COMBO_IDS as combo (combo)}
          <li>
            <span>{text.combos[combo]}</span>
            <span class="values">
              {app.scoreLine(String(COMBO_VALUES[combo].damage), String(COMBO_VALUES[combo].mult))}
            </span>
          </li>
        {/each}
      </ul>
    </section>
  </div>
</Sheet>

<style>
  .help {
    display: grid;
    gap: 14px;
  }

  section {
    display: grid;
    gap: 4px;
  }

  h3 {
    color: var(--gold);
    font-size: 1rem;
  }

  .hint {
    color: var(--muted);
    font-size: 0.85rem;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
    border-bottom: 1px solid var(--line);
  }

  .values {
    font-family: var(--font-display);
    font-weight: 500;
  }
</style>
