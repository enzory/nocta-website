// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.noctaparis.fr',
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
