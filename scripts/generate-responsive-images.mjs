// scripts/generate-responsive-images.mjs
// Génère des variantes responsives pour les images surdimensionnées
// Problème : images 2400px servies sur des slots de 200-400px → 3665 Kio gaspillés

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const IMAGES_DIR = './public/images';
const BREAKPOINTS = [400, 800, 1200]; // px — couvre mobile, tablet, desktop

// Images identifiées par PageSpeed comme surdimensionnées
const TARGETS = [
  // Galerie index (affichées en ~200-400px)
  'nocta-celeri-marche.webp',       // 2400x3200 → affiché en 308x411
  'nocta-assiette-tomate.webp',     // 2400x3200 → affiché en 198x264
  'sainttropez-petitdejeuner-private.webp', // 1800x2400 → affiché en 198x264
  'nocta-madeleine-canele.webp',    // 1200x1010 → affiché en 236x198
  'nocta-assiette-poireau.webp',    // 1355x1600 → affiché en 308x364
  // Heroes carousel (affichées en plein écran mobile ~1080px)
  'nocta-fleur-courgette-hero3.webp', // 2400x3200 → affiché en 1080x1440
  'nocta-pancetta-hero4.webp',        // 2400x3201 → affiché en 1080x1440
  'nocta-assiette-hero1.webp',        // si présent en 2400px+
];

let generated = 0;
let skipped = 0;

for (const filename of TARGETS) {
  const inputPath = path.join(IMAGES_DIR, filename);

  if (!fs.existsSync(inputPath)) {
    console.warn(`⚠️  Introuvable : ${filename} — ignoré`);
    skipped++;
    continue;
  }

  const meta = await sharp(inputPath).metadata();
  const baseName = filename.replace('.webp', '');

  for (const width of BREAKPOINTS) {
    // Ne pas upscaler — inutile de générer une variante plus grande que l'original
    if (width >= meta.width) {
      console.log(`⏭️  ${filename} @${width}w — original plus petit (${meta.width}px), ignoré`);
      continue;
    }

    const outputFilename = `${baseName}-${width}w.webp`;
    const outputPath = path.join(IMAGES_DIR, outputFilename);

    if (fs.existsSync(outputPath)) {
      console.log(`⏭️  ${outputFilename} — déjà existant`);
      skipped++;
      continue;
    }

    await sharp(inputPath)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outputPath);

    const originalSize = fs.statSync(inputPath).size;
    const newSize = fs.statSync(outputPath).size;
    const saving = Math.round((1 - newSize / originalSize) * 100);

    console.log(`✅ ${outputFilename} — ${Math.round(newSize / 1024)} Ko (-${saving}% vs original)`);
    generated++;
  }
}

console.log(`\n──────────────────────────────────`);
console.log(`Variantes générées : ${generated}`);
console.log(`Ignorées           : ${skipped}`);
console.log(`──────────────────────────────────`);
console.log(`\n⚠️  Étape suivante : ajouter srcset + sizes dans les .astro`);
