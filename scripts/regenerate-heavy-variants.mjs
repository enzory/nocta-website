// scripts/regenerate-heavy-variants.mjs
// Régénère, depuis l'ORIGINAL, les variantes -400w/-800w/-1200w qui pesaient
// plus lourd que la photo dont elles sont tirées (elles avaient été encodées
// en qualité 92 + accentuation : hero3-1200w faisait 939 Ko pour un original
// de 755 Ko). L'original n'est jamais réécrit : aucune photo ne change, aucun
// recadrage — seul le redimensionnement proportionnel est refait.
//
// Qualité : 74 (celle de generate-responsive-images.mjs), abaissée par paliers
// de 6 jusqu'aux seuils du projet (400w ≤ 60 Ko, 800w ≤ 150 Ko, 1200w ≤ 300 Ko)
// et, dans tous les cas, sous le poids de l'original. Plancher : 50, relevé à
// 62 pour la photo du hero (plein écran, très texturée) : elle dépasse alors
// un peu les seuils (169 et 329 Ko) mais reste trois fois plus légère qu'avant.
//
// Usage : node scripts/regenerate-heavy-variants.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const DIR = './public/images';
const SEUILS = { 400: 60 * 1024, 800: 150 * 1024, 1200: 300 * 1024 };
const CIBLES = {
  'nocta-fleur-courgette-hero3': { largeurs: [400, 800, 1200], plancher: 62 },
  'nocta-oeuf-truite-bouchees': { largeurs: [400, 800, 1200] },
  'nocta-corporate-enzo': { largeurs: [800, 1200] },
  'hugo-vinatier-chef': { largeurs: [800] },
};

for (const [nom, { largeurs, plancher = 50 }] of Object.entries(CIBLES)) {
  const original = path.join(DIR, `${nom}.webp`);
  const poidsOriginal = fs.statSync(original).size;
  for (const largeur of largeurs) {
    const sortie = path.join(DIR, `${nom}-${largeur}w.webp`);
    const avant = fs.statSync(sortie).size;
    // Une variante plus petite que l'original doit peser moins que lui.
    const max = Math.min(SEUILS[largeur], Math.round(poidsOriginal * 0.9));
    let buf, q;
    for (q = 74; ; q -= 6) {
      buf = await sharp(original).resize({ width: largeur, withoutEnlargement: true }).webp({ quality: q }).toBuffer();
      if (buf.length <= max || q - 6 < plancher) break;
    }
    fs.writeFileSync(sortie, buf);
    console.log(`${nom}-${largeur}w : ${Math.round(avant / 1024)} → ${Math.round(buf.length / 1024)} Ko (q${q}, original ${Math.round(poidsOriginal / 1024)} Ko)`);
  }
}
