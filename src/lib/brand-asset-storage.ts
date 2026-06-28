import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { put } from "@vercel/blob";
import { renderLogoPng } from "@/lib/optimize-brand-logo";
import { blobSdkOptions, isBlobConfigured } from "@/lib/demo-json-blob";
import { normalizeLogoTransform, type LogoTransform } from "@/lib/logo-transform";

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
  logoSourceUrl: string;
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

async function toPngSource(buffer: Buffer, mimeType: string): Promise<Buffer> {
  if (mimeType === "image/png") return buffer;
  return sharp(buffer).png({ compressionLevel: 9, effort: 10 }).toBuffer();
}

export async function processAndStoreBrandLogo(
  buffer: Buffer,
  mimeType: string,
  transform?: Partial<LogoTransform>,
): Promise<BrandAssetUploadResult> {
  validateBrandLogoUpload({ size: buffer.length, mimeType });

  const stamp = randomUUID().slice(0, 8);
  const normalizedTransform = normalizeLogoTransform(transform);
  const sourcePng = await toPngSource(buffer, mimeType);
  const sourceUrl = await storeBuffer(`brand/${stamp}-source.png`, sourcePng, "image/png");

  const urls: Partial<BrandAssetUploadResult> = { logoSourceUrl: sourceUrl };

  for (const variant of VARIANTS) {
    const png = await renderLogoPng(sourcePng, {
      file: variant.file,
      width: variant.width,
      height: variant.key === "faviconUrl" ? variant.width : undefined,
      fit: variant.key === "faviconUrl" ? "cover" : "inside",
    }, normalizedTransform);

    const filename = `${stamp}-${variant.file}`;
    urls[variant.key] = await storeBuffer(`brand/${filename}`, png, "image/png");
  }

  return {
    logoUrl: urls.logoUrl!,
    logoIconUrl: urls.logoIconUrl!,
    faviconUrl: urls.faviconUrl!,
    logoSourceUrl: sourceUrl,
  };
}

export async function renderBrandLogoFromSource(
  sourceBuffer: Buffer,
  transform?: Partial<LogoTransform>,
): Promise<Omit<BrandAssetUploadResult, "logoSourceUrl">> {
  const stamp = randomUUID().slice(0, 8);
  const normalizedTransform = normalizeLogoTransform(transform);
  const urls: Partial<BrandAssetUploadResult> = {};

  for (const variant of VARIANTS) {
    const png = await renderLogoPng(sourceBuffer, {
      file: variant.file,
      width: variant.width,
      height: variant.key === "faviconUrl" ? variant.width : undefined,
      fit: variant.key === "faviconUrl" ? "cover" : "inside",
    }, normalizedTransform);

    const filename = `${stamp}-${variant.file}`;
    urls[variant.key] = await storeBuffer(`brand/${filename}`, png, "image/png");
  }

  return {
    logoUrl: urls.logoUrl!,
    logoIconUrl: urls.logoIconUrl!,
    faviconUrl: urls.faviconUrl!,
  };
}

export async function fetchBrandSourceBuffer(sourceUrl: string): Promise<Buffer> {
  if (sourceUrl.startsWith("/")) {
    const localPath = path.join(process.cwd(), "public", sourceUrl.replace(/^\//, ""));
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }
    const uploadsPath = path.join(process.cwd(), sourceUrl.replace(/^\//, ""));
    if (fs.existsSync(uploadsPath)) {
      return fs.readFileSync(uploadsPath);
    }
    throw new Error("Logo source file not found on server.");
  }

  const res = await fetch(sourceUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Could not load logo source image.");
  }
  return Buffer.from(await res.arrayBuffer());
}