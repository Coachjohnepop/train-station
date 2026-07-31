import "server-only";

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { blobSdkOptions, isBlobConfigured } from "@/lib/demo-json-blob";

export const MEASUREMENT_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const MEASUREMENT_PHOTO_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const LOCAL_DIR = path.join(process.cwd(), "public", "uploads", "measurement-photos");

function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("heic") || m.includes("heif")) return "heic";
  return "jpg";
}

export function validateMeasurementPhoto(file: {
  size: number;
  mimeType: string;
  name?: string;
}) {
  if (file.size <= 0) throw new Error("Empty file.");
  if (file.size > MEASUREMENT_PHOTO_MAX_BYTES) {
    throw new Error(
      `Photo too large (max ${Math.round(MEASUREMENT_PHOTO_MAX_BYTES / 1024 / 1024)} MB).`,
    );
  }
  const mime = (file.mimeType || "").toLowerCase();
  if (!MEASUREMENT_PHOTO_MIME.has(mime) && !mime.startsWith("image/")) {
    throw new Error("Use a photo (JPEG, PNG, or WebP).");
  }
}

export function isAllowedMeasurementPhotoUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const t = url.trim();
  if (t.startsWith("/uploads/measurement-photos/")) return true;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (/\.public\.blob\.vercel-storage\.com$/i.test(u.hostname)) return true;
    if (u.pathname.includes("/measurement-photos/")) return true;
    return /\.(jpe?g|png|webp|heic)(?:$|\?)/i.test(u.pathname);
  } catch {
    return false;
  }
}

export async function storeMeasurementPhoto(
  buffer: Buffer,
  mimeType: string,
  userId: string,
  kind: "before" | "now",
): Promise<{ url: string }> {
  const mime = mimeType || "image/jpeg";
  validateMeasurementPhoto({ size: buffer.length, mimeType: mime });
  const ext = extFromMime(mime);
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "member";
  const relativePath = `measurement-photos/${safeUser}/${kind}-${randomUUID()}.${ext}`;

  if (isBlobConfigured()) {
    const blob = await put(relativePath, buffer, {
      ...blobSdkOptions(),
      contentType: mime,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { url: blob.url };
  }

  const dir = path.join(LOCAL_DIR, safeUser);
  fs.mkdirSync(dir, { recursive: true });
  const base = path.basename(relativePath);
  fs.writeFileSync(path.join(dir, base), buffer);
  return { url: `/uploads/measurement-photos/${safeUser}/${base}` };
}
