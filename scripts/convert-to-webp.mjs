// scripts/convert-to-webp.mjs
// Conversion WebP des images NOCTA — public/images + src/assets/images
// Prérequis : sharp installé (npm install sharp)

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const IMAGES_DIR    = './public/images';
const ORIGINALS_DIR = './public/images/_originals';
const ASSETS_DIR    = './src/assets/images';
const QUALITY       = 80;

// ─── Images public/images à convertir ────────────────────────────────────────
// Heroes + galeries + photos d'approche référencés dans les .astro
const TARGETS = [
  // index.astro — carousel hero
  'nocta-assiette-hero1.jpg',
  'nocta-pancetta-hero4.jpg',
  'nocta-fleur-courgette-hero3.jpg',
  // index.astro — galerie réalisations
  'nocta-assiette-poireau.jpg',
  'nocta-celeri-marche.jpg',
  'nocta-madeleine-canele.jpg',
  'nocta-assiette-tomate.jpg',
  'sainttropez-petitdejeuner-private.jpg',
  // maison.astro — hero + équipe
  'bougie-bois-maison.jpg',
  'hugo-vinatier-chef.jpg',
  'nocta-corporate-enzo.jpg',
  // prestations/index.astro — hero
  'nocta-table-fleure-2.jpg',
  // prestations/corporate.astro — hero + approche
  'reception-levis-corporate.jpg',
  'nocta-table-corporate-apm.jpg',
  // prestations/private.astro — section approche
  'nocta-bouche-private.jpg',
  // prestations/signature.astro — approche
  'salon-signature.jpg',
  // Autres images présentes (non référencées mais incluses pour cohérence)
  'dressage-signature.jpg',
  'petitdejeuner-signature.jpg',
  'produit-tomate-maison.jpg',
  'nocta-tarte-tomate.jpg',
  'nocta-table-haussmann.jpg',
  // og-image.jpeg exclue intentionnellement (social media exige JPEG)
];

// ─── Images src/assets/images à convertir ────────────────────────────────────
// Importées via ?url dans les .astro
const ASSET_TARGETS = [
  'notre-histoire.jpg',   // maison.astro — section histoire
  'private-hero.jpg',     // prestations/private.astro — hero
];

// ─── Setup ────────────────────────────────────────────────────────────────────
if (!fs.existsSync(ORIGINALS_DIR)) {
  fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
  console.log(`✅ Dossier _originals créé`);
}

// ─── Fonction de conversion ───────────────────────────────────────────────────
async function convertImage(inputPath, outputPath, originalDest, label) {
  await sharp(inputPath)
    .rotate()                      // corrige la rotation EXIF
    .webp({ quality: QUALITY })
    .toFile(outputPath);

  fs.renameSync(inputPath, originalDest);

  const originalSize = fs.statSync(originalDest).size;
  const webpSize     = fs.statSync(outputPath).size;
  const saving       = Math.round((1 - webpSize / originalSize) * 100);

  console.log(`✅ ${label} (-${saving}%)`);
  return true;
}

// ─── Conversion public/images ─────────────────────────────────────────────────
console.log('\n── public/images ──────────────────────────────────────────────');
let converted = 0;
let skipped   = 0;
let errors    = 0;

for (const filename of TARGETS) {
  const inputPath    = path.join(IMAGES_DIR, filename);
  const webpFilename = filename.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  const outputPath   = path.join(IMAGES_DIR, webpFilename);
  const originalDest = path.join(ORIGINALS_DIR, filename);

  if (!fs.existsSync(inputPath)) {
    console.warn(`⚠️  Introuvable : ${filename} — ignoré`);
    skipped++;
    continue;
  }

  if (fs.existsSync(outputPath)) {
    console.log(`⏭️  Déjà converti : ${webpFilename} — ignoré`);
    skipped++;
    continue;
  }

  try {
    await convertImage(
      inputPath, outputPath, originalDest,
      `${filename} → ${webpFilename}`
    );
    converted++;
  } catch (err) {
    console.error(`❌ Erreur sur ${filename} :`, err.message);
    errors++;
  }
}

// ─── Conversion src/assets/images ────────────────────────────────────────────
console.log('\n── src/assets/images ──────────────────────────────────────────');

for (const filename of ASSET_TARGETS) {
  const inputPath    = path.join(ASSETS_DIR, filename);
  const webpFilename = filename.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  const outputPath   = path.join(ASSETS_DIR, webpFilename);
  const originalDest = path.join(ORIGINALS_DIR, filename);

  if (!fs.existsSync(inputPath)) {
    console.warn(`⚠️  Introuvable : ${filename} — ignoré`);
    skipped++;
    continue;
  }

  if (fs.existsSync(outputPath)) {
    console.log(`⏭️  Déjà converti : ${webpFilename} — ignoré`);
    skipped++;
    continue;
  }

  try {
    await convertImage(
      inputPath, outputPath, originalDest,
      `${filename} → ${webpFilename}`
    );
    converted++;
  } catch (err) {
    console.error(`❌ Erreur sur ${filename} :`, err.message);
    errors++;
  }
}

// ─── Résumé ───────────────────────────────────────────────────────────────────
console.log(`\n──────────────────────────────────`);
console.log(`Convertis : ${converted}`);
console.log(`Ignorés   : ${skipped}`);
console.log(`Erreurs   : ${errors}`);
console.log(`──────────────────────────────────`);
if (errors === 0) {
  console.log(`\n✅ Conversion terminée — penser à mettre à jour les références .jpg → .webp dans les .astro`);
}
