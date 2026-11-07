<script lang="ts">
import { panel } from '../logic/panels.ts';
import { texts } from '../logic/texts.ts';
import Sheet from './Sheet.svelte';

const app = $derived($texts.text.app);
</script>

<Sheet title={app.about} onClose={() => panel.set(null)}>
  <div class="about">
    <p>{app.aboutGame}</p>
    <p>{app.aboutData}</p>
    <p>{app.aboutLegal}</p>
    <p>{app.aboutLicense}</p>
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
