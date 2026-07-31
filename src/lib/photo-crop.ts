/**
 * Display crop for vertical progress portraits (measurements sheet).
 * Stored in Postgres; applied via CSS object-position + scale.
 */

export type PhotoCrop = {
  /** Horizontal focal point 0–100 (object-position x %) */
  focusX: number;
  /** Vertical focal point 0–100 (object-position y %) — lower = more headroom/top */
  focusY: number;
  /** Zoom 1–2.5 */
  zoom: number;
};

export const DEFAULT_PHOTO_CROP: PhotoCrop = {
  focusX: 50,
  focusY: 25,
  zoom: 1,
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizePhotoCrop(raw?: {
  focusX?: number | null;
  focusY?: number | null;
  zoom?: number | null;
  photoFocusX?: number | null;
  photoFocusY?: number | null;
  photoZoom?: number | null;
  beforePhotoFocusX?: number | null;
  beforePhotoFocusY?: number | null;
  beforePhotoZoom?: number | null;
} | null): PhotoCrop {
  if (!raw) return { ...DEFAULT_PHOTO_CROP };
  const x =
    raw.focusX ?? raw.photoFocusX ?? raw.beforePhotoFocusX ?? DEFAULT_PHOTO_CROP.focusX;
  const y =
    raw.focusY ?? raw.photoFocusY ?? raw.beforePhotoFocusY ?? DEFAULT_PHOTO_CROP.focusY;
  const z = raw.zoom ?? raw.photoZoom ?? raw.beforePhotoZoom ?? DEFAULT_PHOTO_CROP.zoom;
  return {
    focusX: clamp(Number(x) || 50, 0, 100),
    focusY: clamp(Number(y) || 25, 0, 100),
    zoom: clamp(Number(z) || 1, 1, 2.5),
  };
}

/** CSS properties for a vertical portrait frame (cover + pan + zoom). */
export function photoCropStyle(crop: PhotoCrop): {
  objectFit: "cover";
  objectPosition: string;
  transform?: string;
  transformOrigin: string;
  width: string;
  height: string;
  maxWidth: string;
  maxHeight: string;
  display: string;
} {
  return {
    objectFit: "cover",
    objectPosition: `${crop.focusX}% ${crop.focusY}%`,
    transform: crop.zoom > 1.01 ? `scale(${crop.zoom})` : undefined,
    transformOrigin: `${crop.focusX}% ${crop.focusY}%`,
    width: "100%",
    height: "100%",
    maxWidth: "none",
    maxHeight: "none",
    display: "block",
  };
}
