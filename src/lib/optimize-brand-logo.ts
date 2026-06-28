import sharp from "sharp";

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

export type LogoVariant = {
  file: string;
  width: number;
  height?: number;
  fit?: "inside" | "cover";
};

export async function renderLogoPng(
  source: Buffer,
  variant: LogoVariant,
): Promise<Buffer> {
  const meta = await sharp(source).metadata();
  const hasAlpha = Boolean(meta.hasAlpha);

  let pipeline = sharp(source).rotate();

  const resizeHeight = variant.height ?? variant.width;
  pipeline = pipeline.resize({
    width: variant.width,
    height: resizeHeight,
    fit: variant.fit || "inside",
    withoutEnlargement: true,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  let rendered = await pipeline.png({ compressionLevel: 9, effort: 10 }).toBuffer();

  if (!hasAlpha) {
    rendered = await stripNearBlackMatte(rendered);
  }

  return rendered;
}