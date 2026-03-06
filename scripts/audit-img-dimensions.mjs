// scripts/audit-img-dimensions.mjs
// Lit les dimensions réelles de toutes les images du site
// et génère un rapport JSON utilisable pour injecter width/height dans les .astro

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const IMAGES_DIR  = './public/images';
const ASSETS_DIR  = './src/assets/images';
const OUTPUT_FILE = './scripts/img-dimensions.json';

// Récupère tous les fichiers image (hors _originals)
const IMG_EXT = /\.(webp|jpg|jpeg|png)$/i;

function listImages(dir) {
  return fs.readdirSync(dir)
    .filter(f => IMG_EXT.test(f))
    .map(f => path.join(dir, f));
}

const files = [...listImages(IMAGES_DIR), ...listImages(ASSETS_DIR)];

const dimensions = {};

for (const file of files) {
  try {
    const meta     = await sharp(file).metadata();
    const filename = path.basename(file);
    dimensions[filename] = {
      width:  meta.width,
      height: meta.height,
    };
    console.log(`✅ ${filename} → ${meta.width}x${meta.height}`);
  } catch (err) {
    console.error(`❌ ${path.basename(file)} :`, err.message);
  }
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dimensions, null, 2));
console.log(`\n📄 Rapport écrit dans ${OUTPUT_FILE}`);
console.log(`Total : ${Object.keys(dimensions).length} images indexées`);
