import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import packageFile from './package.json' with { type: 'json' };

const DAY = 60 * 60 * 24;

export default defineConfig({
  // Chemins relatifs : le jeu marche à la racine d'un domaine comme dans un sous-dossier.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(packageFile.version) },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: './',
        name: 'Combodex',
        short_name: 'Combodex',
        description: 'Roguelite de deckbuilding basé sur les vraies cartes du JCC Pokémon.',
        lang: 'fr',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b0f1e',
        theme_color: '#0b0f1e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        // Le jeu n'existe qu'en français et en anglais.
        globIgnores: ['**/*-cyrillic*', '**/*-vietnamese*'],
        // Les images ne sont jamais copiées avec le jeu : seules celles déjà vues sont gardées.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/assets\.tcgdex\.net\/.*\.webp$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-images',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 700, maxAgeSeconds: 90 * DAY, purgeOnQuotaError: true },
            },
          },
        ],
      },
    }),
  ],
});
