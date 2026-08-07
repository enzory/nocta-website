// Génère public/img/plateaux/placeholder.jpg — fond cream NOCTA (#EEEBE3).
// À exécuter une fois : `node scripts/generate-plateaux-placeholder.mjs`.
// Le fichier produit est commité dans le repo et n'est pas régénéré au build.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const out = 'public/img/plateaux/placeholder.jpg';
await mkdir(dirname(out), { recursive: true });

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#EEEBE3"/>
  <g fill="none" stroke="#000000" stroke-opacity="0.12" stroke-width="1.2">
    <circle cx="600" cy="600" r="380"/>
    <circle cx="600" cy="600" r="240"/>
  </g>
  <text x="600" y="612" text-anchor="middle"
        font-family="Cormorant Garamond, Georgia, serif"
        font-style="italic" font-size="44" fill="#000000" fill-opacity="0.32"
        letter-spacing="2">photo à venir</text>
</svg>`;

await sharp(Buffer.from(svg))
  .jpeg({ quality: 78, mozjpeg: true })
  .toFile(out);

console.log(`✓ ${out}`);
