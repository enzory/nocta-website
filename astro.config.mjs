// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://noctaparis.fr',
  trailingSlash: 'never',
  redirects: {
    '/events': '/prestations',
    '/nocta-signature': '/prestations/signature',
    '/nocta-corporate': '/prestations/corporate',
    '/nocta-private': '/prestations/private',
    '/demande-de-devis': '/contact',
    '/blog': '/journal',
    '/journal/traiteur-la-defense.md': '/journal/traiteur-la-defense',
    '/events/diner-prive-saint-tropez': { status: 301, destination: '/prestations/private' },
    '/mention-legal': { status: 301, destination: '/mentions-legales' },
  },
  integrations: [sitemap({
    filter: (page) =>
      !page.includes('/merci') &&
      !page.includes('/mentions-legales') &&
      !page.includes('/commande/'),
  }), react()],
  vite: {
    plugins: [tailwindcss()]
  }
});