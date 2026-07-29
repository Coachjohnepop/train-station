import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { blobSdkOptions, isBlobConfigured } from "@/lib/demo-json-blob";

/** ~8 MB — long coach clips without blowing Vercel body limits. Prefer client upload when blob is on. */
export const REST_SOUND_MAX_BYTES = 8 * 1024 * 1024;

export const REST_SOUND_ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/webm",
]);

const LOCAL_DIR = path.join(process.cwd(), "public", "uploads", "rest-sounds");

export function restSoundExtFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("m4a") || m === "audio/mp4") return "m4a";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("webm")) return "webm";
  return "mp3";
}

export function restSoundMimeFromName(name: string, fallback = "audio/mpeg"): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".webm")) return "audio/webm";
  return fallback;
}

export function validateRestSoundFile(input: {
  size: number;
  mimeType: string;
  name?: string;
}): void {
  if (input.size <= 0) throw new Error("Empty audio file.");
  if (input.size > REST_SOUND_MAX_BYTES) {
    throw new Error(
      `Sound too large (max ${Math.round(REST_SOUND_MAX_BYTES / (1024 * 1024))} MB).`,
    );
  }
  const mime = (input.mimeType || "").toLowerCase();
  const ok =
    REST_SOUND_ALLOWED_MIME.has(mime) ||
    mime.startsWith("audio/") ||
    Boolean(input.name && /\.(mp3|wav|m4a|ogg|webm)$/i.test(input.name));
  if (!ok) {
    throw new Error("Use MP3, WAV, M4A, OGG, or WebM audio.");
  }
}

async function storeBuffer(
  relativePath: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (isBlobConfigured()) {
    const blob = await put(relativePath, buffer, {
      ...blobSdkOptions(),
      contentType: mimeType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return blob.url;
  }

  try {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
    const filePath = path.join(LOCAL_DIR, path.basename(relativePath));
    fs.writeFileSync(filePath, buffer);
    return `/uploads/rest-sounds/${path.basename(relativePath)}`;
  } catch (e) {
    console.warn("Local rest sound save failed", e);
    throw new Error(
      "Could not store sound. Set BLOB_READ_WRITE_TOKEN for durable uploads.",
    );
  }
}

export async function storeRestSound(
  buffer: Buffer,
  mimeType: string,
  originalName?: string,
): Promise<{ url: string }> {
  const resolvedMime =
    mimeType && mimeType !== "application/octet-stream"
      ? mimeType
      : restSoundMimeFromName(originalName || "sound.mp3");
  validateRestSoundFile({
    size: buffer.length,
    mimeType: resolvedMime,
    name: originalName,
  });
  const ext = restSoundExtFromMime(resolvedMime);
  const filename = `${randomUUID()}.${ext}`;
  const url = await storeBuffer(`rest-sounds/${filename}`, buffer, resolvedMime);
  return { url };
}
