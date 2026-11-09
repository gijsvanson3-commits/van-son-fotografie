// Maakt geoptimaliseerde WebP-versies in meerdere breedtes voor srcset.
// Gebruik (eenmalig sharp installeren, buiten de site om):
//   cd tools && npm install && node optimize-images.mjs
// Bronnen: assets/images/*.{jpg,jpeg,png,webp}
// Uitvoer: assets/images/opt/<naam>-<breedte>.webp + manifest.json
import { readdir, mkdir, stat, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'assets', 'images');
const outputDir = path.join(sourceDir, 'opt');
const widths = [480, 720, 960, 1440, 2048];
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

// Kwaliteit 88 met smartSubsample: verzadigde kleuren (neon, rood licht) en donkere vlakken
// blijven scherp, zonder blokjes. Veranderen deze instellingen, dan worden alle foto's opnieuw gemaakt.
const webpSettings = { quality: 88, effort: 6, smartSubsample: true };
const settingsFile = path.join(outputDir, 'instellingen.json');
const settingsText = `${JSON.stringify(webpSettings)}\n`;
let settingsChanged = true;
try {
  settingsChanged = (await readFile(settingsFile, 'utf8')) !== settingsText;
} catch {}

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
  // Geen standaardbreedte die bijna even groot is als het origineel (bijv. 1440 naast 1441).
  const targetWidths = widths.filter((w) => w < width * 0.95);
  if (width <= widths.at(-1)) targetWidths.push(width);
  else targetWidths.push(widths.at(-1));
  const unique = [...new Set(targetWidths)].sort((a, b) => a - b);

  for (const w of unique) {
    const target = path.join(outputDir, `${slug}-${w}.webp`);
    if (!settingsChanged && (await isFresh(target, sourceTime))) continue;
    await sharp(source).rotate().resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' }).webp(webpSettings).toFile(target);
  }

  manifest[file] = { slug, width, height, widths: unique };
  console.log(`${file} -> ${unique.map((w) => `${slug}-${w}.webp`).join(', ')}`);
}

await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(settingsFile, settingsText);
