import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { renderLogoPng } from "@/lib/optimize-brand-logo";
import { blobSdkOptions, isBlobConfigured } from "@/lib/demo-json-blob";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 8 * 1024 * 1024;
const LOCAL_DIR = path.join(process.cwd(), "public", "uploads", "brand");

const VARIANTS = [
  { key: "logoUrl" as const, file: "logo.png", width: 480 },
  { key: "logoIconUrl" as const, file: "logo-icon.png", width: 128 },
  { key: "faviconUrl" as const, file: "favicon.png", width: 32 },
];

export type BrandAssetUploadResult = {
  logoUrl: string;
  logoIconUrl: string;
  faviconUrl: string;
};

async function storeBuffer(
  relativePath: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (isBlobConfigured()) {
    const blob = await put(relativePath, buffer, {
      ...blobSdkOptions(),
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return blob.url;
  }

  const localPath = path.join(LOCAL_DIR, path.basename(relativePath));
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  fs.writeFileSync(localPath, buffer);
  return `/uploads/brand/${path.basename(relativePath)}`;
}

export function validateBrandLogoUpload(params: { size: number; mimeType: string }) {
  if (!ALLOWED_MIME.has(params.mimeType)) {
    throw new Error("Logo must be PNG, JPEG, WebP, or GIF.");
  }
  if (params.size > MAX_BYTES) {
    throw new Error("Logo file is too large (max 8 MB).");
  }
}

export async function processAndStoreBrandLogo(
  buffer: Buffer,
  mimeType: string,
): Promise<BrandAssetUploadResult> {
  validateBrandLogoUpload({ size: buffer.length, mimeType });

  const stamp = randomUUID().slice(0, 8);
  const urls: Partial<BrandAssetUploadResult> = {};

  for (const variant of VARIANTS) {
    const png = await renderLogoPng(buffer, {
      file: variant.file,
      width: variant.width,
      height: variant.key === "faviconUrl" ? variant.width : undefined,
      fit: variant.key === "faviconUrl" ? "cover" : "inside",
    });

    const filename = `${stamp}-${variant.file}`;
    const relativePath = `brand/${filename}`;
    urls[variant.key] = await storeBuffer(relativePath, png, "image/png");
  }

  return {
    logoUrl: urls.logoUrl!,
    logoIconUrl: urls.logoIconUrl!,
    faviconUrl: urls.faviconUrl!,
  };
}