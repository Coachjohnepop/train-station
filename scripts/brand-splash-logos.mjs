#!/usr/bin/env node
/**
 * Overlay The Train Station circular logo onto hero splash photos (chest placement).
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOT = path.join(import.meta.dirname, "..");
const SPLASH_DIR = path.join(ROOT, "public/images/splash");
const LOGO = path.join(ROOT, "public/images/logo.png");

/** left/top as fraction of image size; scale = logo width / image width */
const PLACEMENTS = {
  "black-guy.jpg": { left: 0.47, top: 0.36, scale: 0.085 },
  "blonde-girl.jpg": { left: 0.44, top: 0.32, scale: 0.075 },
  "hispanic-split-squat.jpg": { left: 0.41, top: 0.27, scale: 0.078 },
  "asian-woman.jpg": { left: 0.45, top: 0.34, scale: 0.082 },
};

async function logoWithTransparency(targetWidth) {
  const resized = await sharp(LOGO)
    .resize(targetWidth, targetWidth, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Drop outer black matte; keep blue/white/train artwork.
    if (r < 28 && g < 28 && b < 28) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function brandSplash(filename) {
  const placement = PLACEMENTS[filename];
  if (!placement) throw new Error(`No placement for ${filename}`);

  const inputPath = path.join(SPLASH_DIR, filename);
  const backupPath = path.join(SPLASH_DIR, filename.replace(/\.jpg$/, ".pre-brand.jpg"));

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(inputPath, backupPath);
  }

  const base = sharp(inputPath);
  const meta = await base.metadata();
  const logoWidth = Math.round(meta.width * placement.scale);
  const logoBuf = await logoWithTransparency(logoWidth);
  const logoMeta = await sharp(logoBuf).metadata();

  const left = Math.round(meta.width * placement.left);
  const top = Math.round(meta.height * placement.top);

  const x = Math.min(left, meta.width - logoMeta.width - 4);
  const y = Math.min(top, meta.height - logoMeta.height - 4);

  // Slight soft edge so the badge reads like apparel print, not a sticker.
  const softLogo = await sharp(logoBuf).blur(0.3).png().toBuffer();

  await base
    .composite([
      {
        input: softLogo,
        left: x,
        top: y,
        blend: "over",
      },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(inputPath + ".tmp");

  fs.renameSync(inputPath + ".tmp", inputPath);
  console.log(`✓ branded ${filename}`);
}

for (const file of Object.keys(PLACEMENTS)) {
  await brandSplash(file);
}