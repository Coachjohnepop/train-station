#!/usr/bin/env node
/**
 * Build responsive logo PNGs from a source image (preserves or derives transparency).
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

async function stripNearBlackMatte(buffer, threshold = 28) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels < 4) return buffer;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r <= threshold && g <= threshold && b <= threshold) data[i + 3] = 0;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function renderLogoPng(source, { width, fit = "inside" }) {
  const meta = await sharp(source).metadata();
  let rendered = await sharp(source)
    .rotate()
    .resize({ width, fit, withoutEnlargement: true, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
  if (!meta.hasAlpha) rendered = await stripNearBlackMatte(rendered);
  return rendered;
}

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

  const meta = await sharp(source).metadata();
  console.log(`Source: ${source} (${meta.width}x${meta.height}, ${meta.format}, alpha=${meta.hasAlpha})`);

  for (const { file, width } of VARIANTS) {
    const dest = path.join(OUT_DIR, file);
    const buffer = await renderLogoPng(source, { width });
    fs.writeFileSync(dest, buffer);
    const outMeta = await sharp(buffer).metadata();
    console.log(
      `  ${file}: ${(buffer.length / 1024).toFixed(1)} KB (${outMeta.width}x${outMeta.height}, alpha=${outMeta.hasAlpha})`,
    );
  }

  const favicon = await sharp(await renderLogoPng(source, { width: 64 }))
    .resize({ width: 32, height: 32, fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(ROOT, "public/favicon.png"), favicon);
  console.log(`  favicon.png: ${(favicon.length / 1024).toFixed(1)} KB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});