import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { blobSdkOptions, isBlobConfigured } from "@/lib/demo-json-blob";
import {
  SITE_VIDEO_MAX_BYTES,
  siteVideoExtFromMime,
  siteVideoMimeFromName,
  validateSiteVideoFile,
} from "@/lib/site-video";

const LOCAL_DIR = path.join(process.cwd(), "public", "uploads", "site-videos");

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
    return `/uploads/site-videos/${path.basename(relativePath)}`;
  } catch (e) {
    console.warn("Local site video save failed", e);
    throw new Error(
      "Could not store video. Set BLOB_READ_WRITE_TOKEN (Vercel Blob) for durable uploads.",
    );
  }
}

function resolveMime(mimeType: string, name?: string): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  return siteVideoMimeFromName(name || "video.mp4", "video/mp4");
}

/**
 * Server-side store for coach intro / per-ticket videos.
 * Prefer client upload for files over ~4 MB on Vercel (request body limit).
 */
export async function storeSiteVideo(
  buffer: Buffer,
  mimeType: string,
  originalName?: string,
): Promise<{ url: string }> {
  const resolvedMime = resolveMime(mimeType, originalName);
  validateSiteVideoFile({ size: buffer.length, mimeType: resolvedMime, name: originalName });

  const ext = siteVideoExtFromMime(resolvedMime);
  const filename = `${randomUUID()}.${ext}`;
  const url = await storeBuffer(`site-videos/${filename}`, buffer, resolvedMime);
  return { url };
}

export { SITE_VIDEO_MAX_BYTES };
