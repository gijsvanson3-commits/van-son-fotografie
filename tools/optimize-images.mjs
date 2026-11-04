// Maakt geoptimaliseerde WebP-versies in meerdere breedtes voor srcset.
// Gebruik (eenmalig sharp installeren, buiten de site om):
//   cd tools && npm install && node optimize-images.mjs
// Bronnen: assets/images/*.{jpg,jpeg,png,webp}
// Uitvoer: assets/images/opt/<naam>-<breedte>.webp + manifest.json
import { readdir, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'assets', 'images');
const outputDir = path.join(sourceDir, 'opt');
const widths = [480, 960, 1440, 2048];
const skip = new Set(['Group16.png']);

export function slugify(fileName) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/\.(jpe?g|png)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function isFresh(target, sourceTime) {
  try {
    return (await stat(target)).mtimeMs >= sourceTime;
  } catch {
    return false;
  }
}

await mkdir(outputDir, { recursive: true });
const manifest = {};
const usedSlugs = new Set();
// WebP-bronnen eerst, zodat zij bij gelijke namen de korte slug krijgen.
const files = (await readdir(sourceDir))
  .filter((file) => /\.(jpe?g|png|webp)$/i.test(file) && !skip.has(file))
  .sort((a, b) => Number(!/\.webp$/i.test(a)) - Number(!/\.webp$/i.test(b)) || a.localeCompare(b));

for (const file of files) {
  const source = path.join(sourceDir, file);
  const sourceTime = (await stat(source)).mtimeMs;
  const image = sharp(source).rotate();
  const { width, height } = await image.metadata();
  let slug = slugify(file);
  if (usedSlugs.has(slug)) slug = `${slug}-${path.extname(file).slice(1).toLowerCase()}`;
  usedSlugs.add(slug);
  const targetWidths = widths.filter((w) => w < width);
  if (width <= widths.at(-1)) targetWidths.push(width);
  else targetWidths.push(widths.at(-1));
  const unique = [...new Set(targetWidths)].sort((a, b) => a - b);

  for (const w of unique) {
    const target = path.join(outputDir, `${slug}-${w}.webp`);
    if (await isFresh(target, sourceTime)) continue;
    await sharp(source).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toFile(target);
  }

  manifest[file] = { slug, width, height, widths: unique };
  console.log(`${file} -> ${unique.map((w) => `${slug}-${w}.webp`).join(', ')}`);
}

await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
