export type LogoTransform = {
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  cropInset: number;
};

export const DEFAULT_LOGO_TRANSFORM: LogoTransform = {
  scale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  cropInset: 0,
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizeLogoTransform(raw: unknown): LogoTransform {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_LOGO_TRANSFORM };
  const data = raw as Partial<LogoTransform>;
  return {
    scale: clamp(typeof data.scale === "number" ? data.scale : 1, 0.4, 2.5),
    rotation: clamp(typeof data.rotation === "number" ? data.rotation : 0, -180, 180),
    offsetX: clamp(typeof data.offsetX === "number" ? data.offsetX : 0, -50, 50),
    offsetY: clamp(typeof data.offsetY === "number" ? data.offsetY : 0, -50, 50),
    cropInset: clamp(typeof data.cropInset === "number" ? data.cropInset : 0, 0, 45),
  };
}