// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.noctaparis.fr',
  redirects: {
    '/events': '/prestations',
    '/nocta-signature': '/prestations/signature',
    '/nocta-corporate': '/prestations/corporate',
    '/nocta-private': '/prestations/private',
    '/demande-de-devis': '/contact',
    '/blog': '/journal',
    '/journal/traiteur-la-defense.md': '/journal/traiteur-la-defense',
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/merci') &&
        !page.includes('/mentions-legales'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
