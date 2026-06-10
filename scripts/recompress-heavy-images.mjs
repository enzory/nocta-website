// scripts/recompress-heavy-images.mjs
// Recompresse les images au-dessus des seuils de poids (Lot 1, item 1.7).
// - Les variantes -400w/-800w/-1200w sont régénérées depuis l'original
//   (meilleure chaîne de qualité), qualité abaissée par paliers jusqu'au seuil.
// - Les originaux sont recompressés en dernier (auto-réencodage lossy).
// Seuils : 800w ≤ 150 Ko · 1200w ≤ 300 Ko · original ≤ 500 Ko · 400w ≤ 60 Ko.

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const IMAGES_DIR = './public/images';
const THRESHOLDS = { 400: 60 * 1024, 800: 150 * 1024, 1200: 300 * 1024, original: 500 * 1024 };
const QUALITY_START = 74;
const QUALITY_FLOOR = 50;
const QUALITY_STEP = 6;

const files = fs.readdirSync(IMAGES_DIR).filter((f) => f.endsWith('.webp'));
const variantRe = /-(\d+)w\.webp$/;

// Encode `input` (buffer ou chemin) vers `outputPath`, en baissant la qualité
// par paliers jusqu'à passer sous `maxBytes` (ou atteindre le plancher).
async function encodeUnder(input, outputPath, width, maxBytes) {
  for (let q = QUALITY_START; q >= QUALITY_FLOOR; q -= QUALITY_STEP) {
    let pipeline = sharp(input);
    if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true });
    const buf = await pipeline.webp({ quality: q }).toBuffer();
    if (buf.length <= maxBytes || q - QUALITY_STEP < QUALITY_FLOOR) {
      fs.writeFileSync(outputPath, buf);
      return { quality: q, bytes: buf.length };
    }
  }
}

let done = 0;
for (const file of files) {
  const m = file.match(variantRe);
  if (!m) continue; // originaux traités après les variantes
  const width = Number(m[1]);
  const max = THRESHOLDS[width];
  const p = path.join(IMAGES_DIR, file);
  if (!max || fs.statSync(p).size <= max) continue;

  const original = path.join(IMAGES_DIR, file.replace(variantRe, '.webp'));
  const source = fs.existsSync(original) ? original : p;
  const before = fs.statSync(p).size;
  const r = await encodeUnder(source, p, width, max);
  console.log(`✅ ${file} — ${Math.round(before / 1024)} → ${Math.round(r.bytes / 1024)} Ko (q${r.quality})`);
  done++;
}

for (const file of files) {
  if (variantRe.test(file)) continue;
  const p = path.join(IMAGES_DIR, file);
  const before = fs.statSync(p).size;
  if (before <= THRESHOLDS.original) continue;
  const input = fs.readFileSync(p); // buffer : évite de lire un fichier en cours d'écrasement
  const r = await encodeUnder(input, p, null, THRESHOLDS.original);
  console.log(`✅ ${file} — ${Math.round(before / 1024)} → ${Math.round(r.bytes / 1024)} Ko (q${r.quality})`);
  done++;
}

console.log(`\nFichiers recompressés : ${done}`);
