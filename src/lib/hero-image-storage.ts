import "server-only";

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { blobSdkOptions, isBlobConfigured } from "@/lib/demo-json-blob";
import { HERO_IMAGE_MAX_BYTES } from "@/lib/hero-slides";

export { HERO_IMAGE_MAX_BYTES };
export const HERO_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const LOCAL_DIR = path.join(process.cwd(), "public", "uploads", "hero");

export function heroImageExtFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("avif")) return "avif";
  return "jpg";
}

export function validateHeroImageFile(file: { size: number; mimeType: string; name?: string }) {
  if (file.size <= 0) throw new Error("Empty file.");
  if (file.size > HERO_IMAGE_MAX_BYTES) {
    throw new Error(`Image too large (max ${Math.round(HERO_IMAGE_MAX_BYTES / 1024 / 1024)} MB).`);
  }
  const mime = (file.mimeType || "").toLowerCase();
  if (!HERO_IMAGE_MIME.has(mime) && !mime.startsWith("image/")) {
    throw new Error("Use JPEG, PNG, WebP, GIF, or AVIF.");
  }
}

export async function storeHeroImage(
  buffer: Buffer,
  mimeType: string,
  fileName?: string,
): Promise<{ url: string }> {
  const mime = mimeType || "image/jpeg";
  validateHeroImageFile({ size: buffer.length, mimeType: mime, name: fileName });
  const ext = heroImageExtFromMime(mime);
  const relativePath = `hero/${randomUUID()}.${ext}`;

  if (isBlobConfigured()) {
    const blob = await put(relativePath, buffer, {
      ...blobSdkOptions(),
      contentType: mime,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { url: blob.url };
  }

  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  const base = path.basename(relativePath);
  fs.writeFileSync(path.join(LOCAL_DIR, base), buffer);
  return { url: `/uploads/hero/${base}` };
}
