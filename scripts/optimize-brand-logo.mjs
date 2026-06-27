#!/usr/bin/env node
/**
 * Build responsive logo PNGs from a source image.
 * Usage: node scripts/optimize-brand-logo.mjs [sourcePath]
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_SOURCE =
  "/Users/johnpopham/Desktop/Stuff/Lemon Voice/The Train Station/Images/320DA6C0-3FA4-41A2-B4FA-656530FBDFA8.PNG.jpg";
const OUT_DIR = path.join(ROOT, "public/images");
const BACKUP_DIR = path.join(OUT_DIR, "logo-backups");

const VARIANTS = [
  { file: "logo.png", width: 480 },
  { file: "logo-icon.png", width: 128 },
  { file: "logo-hero.png", width: 320 },
];

async function main() {
  const source = process.argv[2] || DEFAULT_SOURCE;
  if (!fs.existsSync(source)) {
    console.error(`Source not found: ${source}`);
    process.exit(1);
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  for (const { file } of VARIANTS) {
    const dest = path.join(OUT_DIR, file);
    if (fs.existsSync(dest)) {
      const stamp = new Date().toISOString().slice(0, 10);
      fs.copyFileSync(dest, path.join(BACKUP_DIR, `${file.replace(".png", "")}-pre-${stamp}.png`));
    }
  }

  const input = sharp(source).rotate();
  const meta = await input.metadata();
  console.log(`Source: ${source} (${meta.width}x${meta.height}, ${meta.format})`);

  for (const { file, width } of VARIANTS) {
    const dest = path.join(OUT_DIR, file);
    const buffer = await sharp(source)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
      .toBuffer();
    fs.writeFileSync(dest, buffer);
    console.log(`  ${file}: ${(buffer.length / 1024).toFixed(1)} KB (${width}px wide)`);
  }

  const favicon = await sharp(source)
    .rotate()
    .resize({ width: 32, height: 32, fit: "cover" })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
  fs.writeFileSync(path.join(ROOT, "public/favicon.png"), favicon);
  console.log(`  favicon.png: ${(favicon.length / 1024).toFixed(1)} KB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});