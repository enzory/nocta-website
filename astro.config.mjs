// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// https://astro.build/config
//
// NOTE redirects : les redirections 301 sont gérées par Vercel (vercel.json)
// pour produire de vrais 301 HTTP côté serveur, et non des meta-refresh
// HTML client-side comme le ferait `redirects:` ici. Cf. SEO_AUDIT.md.
export default defineConfig({
  site: 'https://www.noctaparis.fr',
  trailingSlash: 'never',
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