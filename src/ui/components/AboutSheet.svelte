<script lang="ts">
import { SETS } from '../../content/sets.ts';
import { indexOfSet } from '../logic/data.ts';
import { panel } from '../logic/panels.ts';
import { texts } from '../logic/texts.ts';
import Sheet from './Sheet.svelte';

const app = $derived($texts.text.app);
const setNames = $derived(
  SETS.map(({ id }) => indexOfSet(id).set.name[$texts.language]).join(', '),
);
</script>

<Sheet title={app.creditsTitle} onClose={() => panel.set(null)}>
  <div class="about">
    <p>{app.aboutGame}</p>
    <p>
      {app.aboutData}
      <a href="https://tcgdex.dev" rel="noreferrer" target="_blank">tcgdex.dev</a>
    </p>
    <p>{app.creditsSets(setNames)}</p>
    <p>{app.aboutLegal}</p>
    <p>{app.aboutLicense}</p>
    <p>{app.creditsFonts}</p>
    <p>{app.creditsIcons}</p>
    <p><a href="https://github.com/petitbonney/combodex" rel="noreferrer" target="_blank">{app.aboutSource}</a></p>
    <p class="version">{app.aboutVersion(__APP_VERSION__)}</p>
  </div>
</Sheet>

<style>
  .about {
    display: grid;
    gap: 10px;
  }

  a {
    color: var(--gold);
  }

  .version {
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
