import sharp from "sharp";
import {
  DEFAULT_LOGO_TRANSFORM,
  normalizeLogoTransform,
  type LogoTransform,
} from "@/lib/logo-transform";

export { type LogoTransform, DEFAULT_LOGO_TRANSFORM, normalizeLogoTransform };

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 } as const;

/** Strip near-black JPEG matte so circular logos float on any site background. */
export async function stripNearBlackMatte(buffer: Buffer, threshold = 28): Promise<Buffer> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels < 4) return buffer;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r <= threshold && g <= threshold && b <= threshold) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/** Apply zoom, pan, crop inset, and rotation on a transparent square canvas. */
export async function applyLogoTransform(
  source: Buffer,
  rawTransform?: Partial<LogoTransform>,
  canvasSize = 1024,
): Promise<Buffer> {
  const transform = normalizeLogoTransform({ ...DEFAULT_LOGO_TRANSFORM, ...rawTransform });
  const meta = await sharp(source).metadata();
  const hasAlpha = Boolean(meta.hasAlpha);

  let working = source;
  const width = meta.width ?? canvasSize;
  const height = meta.height ?? canvasSize;

  if (transform.cropInset > 0) {
    const insetX = Math.round(width * (transform.cropInset / 100));
    const insetY = Math.round(height * (transform.cropInset / 100));
    const extractW = Math.max(1, width - insetX * 2);
    const extractH = Math.max(1, height - insetY * 2);
    working = await sharp(working)
      .extract({ left: insetX, top: insetY, width: extractW, height: extractH })
      .toBuffer();
  }

  const rotated = await sharp(working)
    .rotate(transform.rotation, { background: TRANSPARENT })
    .toBuffer();

  const targetEdge = Math.round(canvasSize * transform.scale);
  const resized = await sharp(rotated)
    .resize({
      width: targetEdge,
      height: targetEdge,
      fit: "inside",
      withoutEnlargement: false,
      background: TRANSPARENT,
    })
    .toBuffer();

  const resizedMeta = await sharp(resized).metadata();
  const rw = resizedMeta.width ?? targetEdge;
  const rh = resizedMeta.height ?? targetEdge;

  const offsetX = Math.round((transform.offsetX / 100) * canvasSize);
  const offsetY = Math.round((transform.offsetY / 100) * canvasSize);
  const left = clamp(Math.round((canvasSize - rw) / 2 + offsetX), 0, Math.max(0, canvasSize - rw));
  const top = clamp(Math.round((canvasSize - rh) / 2 + offsetY), 0, Math.max(0, canvasSize - rh));

  let composed = await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: TRANSPARENT,
    },
  })
    .composite([{ input: resized, left, top }])
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  if (!hasAlpha) {
    composed = await stripNearBlackMatte(composed);
  }

  return composed;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export type LogoVariant = {
  file: string;
  width: number;
  height?: number;
  fit?: "inside" | "cover";
};

export async function renderLogoPng(
  source: Buffer,
  variant: LogoVariant,
  transform?: Partial<LogoTransform>,
): Promise<Buffer> {
  const master = transform
    ? await applyLogoTransform(source, transform)
    : await ensureTransparentMaster(source);

  const resizeHeight = variant.height ?? variant.width;
  let rendered = await sharp(master)
    .resize({
      width: variant.width,
      height: resizeHeight,
      fit: variant.fit || "inside",
      withoutEnlargement: true,
      background: TRANSPARENT,
    })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  return rendered;
}

async function ensureTransparentMaster(source: Buffer): Promise<Buffer> {
  const meta = await sharp(source).metadata();
  if (meta.hasAlpha) return source;
  return stripNearBlackMatte(
    await sharp(source).png({ compressionLevel: 9, effort: 10 }).toBuffer(),
  );
}

/** Write default public logo files from a source buffer + transform. */
export async function writePublicLogoVariants(
  source: Buffer,
  transform?: Partial<LogoTransform>,
  outDir?: string,
): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  const dir = outDir ?? path.join(process.cwd(), "public/images");
  const root = path.join(process.cwd(), "public");

  const variants: LogoVariant[] = [
    { file: "logo.png", width: 480 },
    { file: "logo-icon.png", width: 128 },
    { file: "logo-hero.png", width: 320 },
  ];

  for (const variant of variants) {
    const buffer = await renderLogoPng(source, variant, transform);
    fs.writeFileSync(path.join(dir, variant.file), buffer);
  }

  const favicon = await renderLogoPng(
    source,
    { file: "favicon.png", width: 32, height: 32, fit: "cover" },
    transform,
  );
  fs.writeFileSync(path.join(root, "favicon.png"), favicon);
}