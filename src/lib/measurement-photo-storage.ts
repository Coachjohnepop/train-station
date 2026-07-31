import "server-only";

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { blobSdkOptionVariants, isBlobConfigured } from "@/lib/demo-json-blob";

/** Soft cap after client compress; hard fail above this. */
export const MEASUREMENT_PHOTO_MAX_BYTES = 4 * 1024 * 1024;

const LOCAL_DIR = path.join(process.cwd(), "public", "uploads", "measurement-photos");

function extFromMime(mime: string, name?: string): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("heic") || m.includes("heif")) return "heic";
  const fromName = name?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (fromName === "png" || fromName === "webp" || fromName === "heic" || fromName === "heif") {
    return fromName === "heif" ? "heic" : fromName;
  }
  return "jpg";
}

function looksLikeImage(mime: string, name?: string): boolean {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return true;
  // iOS often sends empty type for camera/library picks
  if (!m || m === "application/octet-stream") {
    return /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(name || "");
  }
  return false;
}

export function validateMeasurementPhoto(file: {
  size: number;
  mimeType: string;
  name?: string;
}) {
  if (file.size <= 0) throw new Error("Empty file.");
  if (file.size > MEASUREMENT_PHOTO_MAX_BYTES) {
    throw new Error(
      `Photo too large (max ${Math.round(MEASUREMENT_PHOTO_MAX_BYTES / 1024 / 1024)} MB). Use a smaller image or try again — we compress on phone when possible.`,
    );
  }
  if (!looksLikeImage(file.mimeType, file.name)) {
    throw new Error("Use a photo from your camera or library (JPEG, PNG, or WebP).");
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
  fileName?: string,
): Promise<{ url: string }> {
  const mime = mimeType || "image/jpeg";
  validateMeasurementPhoto({ size: buffer.length, mimeType: mime, name: fileName });
  const ext = extFromMime(mime, fileName);
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "member";
  const relativePath = `measurement-photos/${safeUser}/${kind}-${randomUUID()}.${ext}`;

  if (isBlobConfigured()) {
    const variants = blobSdkOptionVariants();
    let lastErr: unknown;
    for (const opts of variants) {
      try {
        const blob = await put(relativePath, buffer, {
          ...opts,
          contentType: mime.startsWith("image/") ? mime : "image/jpeg",
          addRandomSuffix: false,
          allowOverwrite: true,
        });
        if (blob?.url) return { url: blob.url };
      } catch (e) {
        lastErr = e;
      }
    }
    const msg = lastErr instanceof Error ? lastErr.message : "Blob upload failed";
    throw new Error(`Could not store photo: ${msg}`);
  }

  // Local dev without Blob
  try {
    const dir = path.join(LOCAL_DIR, safeUser);
    fs.mkdirSync(dir, { recursive: true });
    const base = path.basename(relativePath);
    fs.writeFileSync(path.join(dir, base), buffer);
    return { url: `/uploads/measurement-photos/${safeUser}/${base}` };
  } catch (e) {
    console.warn("[measurement-photo] local write failed", e);
    throw new Error(
      "Could not store photo. Set BLOB_READ_WRITE_TOKEN on the server (Vercel Blob).",
    );
  }
}
