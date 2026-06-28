import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { blobSdkOptions, isBlobConfigured } from "@/lib/demo-json-blob";
import {
  CHAT_IMAGE_MAX_BYTES,
  CHAT_VIDEO_MAX_BYTES,
  CHAT_VIDEO_MAX_DURATION_SEC,
} from "@/lib/chat-video-constants";

export { CHAT_IMAGE_MAX_BYTES, CHAT_VIDEO_MAX_BYTES, CHAT_VIDEO_MAX_DURATION_SEC };

const VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const LOCAL_DIR = path.join(process.cwd(), "public", "uploads", "chat");

async function storeChatBuffer(
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
    return `/uploads/chat/${path.basename(relativePath)}`;
  } catch (e) {
    console.warn("Local chat media save failed", e);
    throw new Error(
      "Could not store media on server. Set BLOB_READ_WRITE_TOKEN (Vercel Blob) or use a YouTube link.",
    );
  }
}

export function validateChatVideoUpload(params: {
  size: number;
  mimeType: string;
  durationSec: number;
}) {
  if (!VIDEO_MIME.has(params.mimeType)) {
    throw new Error("Unsupported video type — use MP4, WebM, or MOV.");
  }
  if (params.durationSec > CHAT_VIDEO_MAX_DURATION_SEC) {
    throw new Error(`Videos must be ${CHAT_VIDEO_MAX_DURATION_SEC} seconds or less. Use a YouTube link for longer clips.`);
  }
  if (params.size > CHAT_VIDEO_MAX_BYTES) {
    throw new Error("Video too large (max 20 MB). Try a shorter clip or YouTube link.");
  }
}

export function validateChatImageUpload(params: { size: number; mimeType: string }) {
  if (!IMAGE_MIME.has(params.mimeType)) {
    throw new Error("Unsupported image type — use JPEG, PNG, WebP, or GIF.");
  }
  if (params.size > CHAT_IMAGE_MAX_BYTES) {
    throw new Error("Image too large (max 5 MB).");
  }
}

export async function storeChatVideo(
  buffer: Buffer,
  mimeType: string,
  durationSec: number,
): Promise<{ url: string; durationSec: number }> {
  validateChatVideoUpload({ size: buffer.length, mimeType, durationSec });

  const ext =
    mimeType === "video/webm" ? "webm" : mimeType === "video/quicktime" ? "mov" : "mp4";
  const filename = `${randomUUID()}.${ext}`;
  const url = await storeChatBuffer(`chat/${filename}`, buffer, mimeType);
  return { url, durationSec };
}

export async function storeChatImage(
  buffer: Buffer,
  mimeType: string,
): Promise<{ url: string }> {
  validateChatImageUpload({ size: buffer.length, mimeType });

  const optimized =
    mimeType === "image/gif"
      ? buffer
      : await sharp(buffer)
          .rotate()
          .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer();

  const filename = `${randomUUID()}.jpg`;
  const url = await storeChatBuffer(`chat/${filename}`, optimized, "image/jpeg");
  return { url };
}