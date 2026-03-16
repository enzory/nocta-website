import sharp from 'sharp';
import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';

const IMAGES_DIR = 'public/images';
const WIDTHS = [400, 800, 1200];
const QUALITY = 92;
const SHARPEN = { sigma: 0.8 };
const VARIANT_PATTERN = /-(\d+)w\.webp$/;

async function main() {
  const files = await readdir(IMAGES_DIR);
  const sources = files.filter(f =>
    f.endsWith('.webp') && !VARIANT_PATTERN.test(f) && !f.startsWith('.')
  );
  console.log(`\n📸 ${sources.length} images full-size trouvées\n`);

  for (const file of sources) {
    const inputPath = join(IMAGES_DIR, file);
    const name = basename(file, '.webp');
    const fileStat = await stat(inputPath);
    if (!fileStat.isFile()) continue;

    const metadata = await sharp(inputPath).metadata();
    const originalWidth = metadata.width;
    console.log(`🔄 ${file} (${originalWidth}px)`);

    for (const width of WIDTHS) {
      if (width >= originalWidth) {
        console.log(`   ⏭  ${width}w — skip`);
        continue;
      }
      const outputPath = join(IMAGES_DIR, `${name}-${width}w.webp`);
      await sharp(inputPath)
        .resize(width)
        .sharpen(SHARPEN)
        .webp({ quality: QUALITY })
        .toFile(outputPath);
      const outputStat = await stat(outputPath);
      console.log(`   ✅ ${width}w → ${(outputStat.size / 1024).toFixed(0)} KB`);
    }
    console.log('');
  }
  console.log('✨ Régénération terminée.\n');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
