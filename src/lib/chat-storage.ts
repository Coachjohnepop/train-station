import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { CHAT_VIDEO_MAX_BYTES, CHAT_VIDEO_MAX_DURATION_SEC } from "@/lib/chat-video-constants";

export { CHAT_VIDEO_MAX_BYTES, CHAT_VIDEO_MAX_DURATION_SEC };

const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

const LOCAL_DIR = path.join(process.cwd(), "public", "uploads", "chat");

export function validateChatVideoUpload(params: {
  size: number;
  mimeType: string;
  durationSec: number;
}) {
  if (!ALLOWED_MIME.has(params.mimeType)) {
    throw new Error("Unsupported video type — use MP4, WebM, or MOV.");
  }
  if (params.durationSec > CHAT_VIDEO_MAX_DURATION_SEC) {
    throw new Error(`Videos must be ${CHAT_VIDEO_MAX_DURATION_SEC} seconds or less. Use a YouTube link for longer clips.`);
  }
  if (params.size > CHAT_VIDEO_MAX_BYTES) {
    throw new Error("Video too large (max 20 MB). Try a shorter clip or YouTube link.");
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

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`chat/${filename}`, buffer, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false,
    });
    return { url: blob.url, durationSec };
  }

  try {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
    const filePath = path.join(LOCAL_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return { url: `/uploads/chat/${filename}`, durationSec };
  } catch (e) {
    console.warn("Local chat video save failed", e);
    throw new Error(
      "Could not store video on server. Set BLOB_READ_WRITE_TOKEN (Vercel Blob) or use a YouTube link.",
    );
  }
}