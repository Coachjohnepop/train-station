/**
 * Cold-traffic landing hero carousel slides.
 * Managed under Admin → Landing → Hero images.
 */

export type HeroSlideKind = "image" | "video";

export type HeroSlide = {
  id: string;
  /** Site path (/images/…) or https Blob URL (photo or MP4/MOV). */
  src: string;
  alt: string;
  /**
   * CSS object-position (e.g. "center 22%"). Kept in sync with focusX/focusY.
   */
  objectPosition: string;
  /** When false, slide is skipped on the public site but kept for re-enable. */
  enabled: boolean;
  kind: HeroSlideKind;
  /** Horizontal focal point 0–100 (object-position x %). */
  focusX: number;
  /** Vertical focal point 0–100 — lower = more headroom. */
  focusY: number;
  /** Crop zoom 1–2.5. */
  zoom: number;
  /** Video only. 1 = native, 0.5 = half-speed slow-mo. */
  playbackRate: number;
  /** Video only. Seconds from the start of the file. */
  trimStartSec: number;
  /** Video only. Seconds; null = play through the end of the file. */
  trimEndSec: number | null;
};

/**
 * Default crops: nose just right of center on tall phones (object-fit: cover).
 * Higher x% pans toward the right of the source so faces that sit mid-right
 * land near ~52–55% of the frame instead of drifting too far right.
 */
export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    id: "hero-black-guy",
    src: "/images/splash/black-guy.jpg",
    alt: "Athlete powering through a heavy lift",
    objectPosition: "58% 20%",
    enabled: true,
    kind: "image",
    focusX: 58,
    focusY: 20,
    zoom: 1,
    playbackRate: 1,
    trimStartSec: 0,
    trimEndSec: null,
  },
  {
    id: "hero-blonde-girl",
    src: "/images/splash/blonde-girl.jpg",
    alt: "Athlete on cable lat pulldowns in Train Station gear",
    objectPosition: "54% 24%",
    enabled: true,
    kind: "image",
    focusX: 54,
    focusY: 24,
    zoom: 1,
    playbackRate: 1,
    trimStartSec: 0,
    trimEndSec: null,
  },
  {
    id: "hero-hispanic-split",
    src: "/images/splash/hispanic-split-squat.jpg",
    alt: "Athlete hitting Bulgarian split squats",
    objectPosition: "58% 22%",
    enabled: true,
    kind: "image",
    focusX: 58,
    focusY: 22,
    zoom: 1,
    playbackRate: 1,
    trimStartSec: 0,
    trimEndSec: null,
  },
  {
    id: "hero-asian-woman",
    src: "/images/splash/asian-woman.jpg",
    alt: "Athlete in an intense training session",
    objectPosition: "54% 20%",
    enabled: true,
    kind: "image",
    focusX: 54,
    focusY: 20,
    zoom: 1,
    playbackRate: 1,
    trimStartSec: 0,
    trimEndSec: null,
  },
];

/** Legacy default framing — upgrade when still stored as this. */
const LEGACY_HERO_OBJECT_POSITION = "center 22%";

/**
 * If a known default slide still has the old centered crop, apply the new
 * face-biased framing. Custom admin crops (any other value) are left alone.
 */
export function applyDefaultHeroFraming(slides: HeroSlide[]): HeroSlide[] {
  const byId = new Map(DEFAULT_HERO_SLIDES.map((s) => [s.id, s]));
  return slides.map((slide) => {
    const def = byId.get(slide.id);
    if (!def) return slide;
    const pos = (slide.objectPosition || "").trim().toLowerCase();
    if (pos === LEGACY_HERO_OBJECT_POSITION || pos === "center" || pos === "50% 22%") {
      const parsed = parseObjectPosition(def.objectPosition);
      return {
        ...slide,
        objectPosition: def.objectPosition,
        focusX: parsed.focusX,
        focusY: parsed.focusY,
      };
    }
    // Also match same splash src with legacy crop (id may have been regenerated)
    const sameSrc =
      slide.src.replace(/\?.*$/, "") === def.src ||
      slide.src.endsWith(def.src.replace("/images/splash/", ""));
    if (sameSrc && (pos === LEGACY_HERO_OBJECT_POSITION || pos === "50% 50%" || pos === "center center")) {
      const parsed = parseObjectPosition(def.objectPosition);
      return {
        ...slide,
        objectPosition: def.objectPosition,
        focusX: parsed.focusX,
        focusY: parsed.focusY,
      };
    }
    return slide;
  });
}

export const HERO_SLIDE_MIN = 1;
export const HERO_SLIDE_MAX = 24;
/** Max upload size for a single hero image (client + server). */
export const HERO_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
/** Hero video clips — shorter than coach intros; still big enough for a phone .MOV. */
export const HERO_VIDEO_MAX_BYTES = 80 * 1024 * 1024;
export const HERO_ZOOM_MIN = 1;
export const HERO_ZOOM_MAX = 2.5;
export const HERO_PLAYBACK_RATES = [1, 0.75, 0.5, 0.35, 0.25] as const;

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|avif)(?:$|\?)/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v)(?:$|\?)/i;

export function isHeroVideoSrc(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return VIDEO_EXT_RE.test(url.trim());
}

export function isAllowedHeroImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const t = url.trim();
  if (t.startsWith("/images/") || t.startsWith("/uploads/") || t.startsWith("/videos/")) {
    return true;
  }
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (/\.public\.blob\.vercel-storage\.com$/i.test(u.hostname)) return true;
    if (IMAGE_EXT_RE.test(u.pathname) || VIDEO_EXT_RE.test(u.pathname)) return true;
    return true; // allow CDN paths without extension
  } catch {
    return t.startsWith("/");
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function keywordPercent(token: string, axis: "x" | "y"): number | null {
  const t = token.trim().toLowerCase();
  if (t === "center") return 50;
  if (axis === "x") {
    if (t === "left") return 0;
    if (t === "right") return 100;
  } else {
    if (t === "top") return 0;
    if (t === "bottom") return 100;
  }
  const m = t.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (m) return clamp(Number(m[1]), 0, 100);
  const n = Number(t);
  if (Number.isFinite(n)) return clamp(n, 0, 100);
  return null;
}

/** Parse CSS object-position into 0–100 focal points. */
export function parseObjectPosition(pos: string | null | undefined): {
  focusX: number;
  focusY: number;
} {
  const raw = (pos || "").trim();
  if (!raw) return { focusX: 50, focusY: 22 };
  const parts = raw.split(/\s+/);
  const x = keywordPercent(parts[0] || "center", "x");
  const y = keywordPercent(parts[1] || parts[0] || "center", "y");
  return {
    focusX: x ?? 50,
    focusY: y ?? 22,
  };
}

export function objectPositionFromFocus(focusX: number, focusY: number): string {
  return `${clamp(focusX, 0, 100)}% ${clamp(focusY, 0, 100)}%`;
}

export function heroSlideCropStyle(slide: Pick<HeroSlide, "focusX" | "focusY" | "zoom" | "objectPosition">): {
  objectFit: "cover";
  objectPosition: string;
  transform?: string;
  transformOrigin: string;
} {
  const parsed = parseObjectPosition(slide.objectPosition);
  const x = Number.isFinite(slide.focusX) ? slide.focusX : parsed.focusX;
  const y = Number.isFinite(slide.focusY) ? slide.focusY : parsed.focusY;
  const zoom = clamp(Number(slide.zoom) || 1, HERO_ZOOM_MIN, HERO_ZOOM_MAX);
  return {
    objectFit: "cover",
    objectPosition: objectPositionFromFocus(x, y),
    transform: zoom > 1.01 ? `scale(${zoom})` : undefined,
    transformOrigin: `${x}% ${y}%`,
  };
}

export function heroPlaybackRate(slide: Pick<HeroSlide, "playbackRate" | "kind">): number {
  const rate = Number(slide.playbackRate);
  if (!Number.isFinite(rate)) return 1;
  return clamp(rate, 0.25, 1);
}

/** Load this video only while it is on screen. Neighbors were still ~60 MB iPhone .MOVs. */
export function heroSlideShouldLoadMedia(
  index: number,
  activeIndex: number,
  _total: number,
  slide: Pick<HeroSlide, "kind" | "src">,
): boolean {
  if (slide.kind !== "video" && !isHeroVideoSrc(slide.src)) return true;
  return index === activeIndex;
}

export function heroSlideHoldMs(slide: HeroSlide): number {
  if (slide.kind !== "video" && !isHeroVideoSrc(slide.src)) return 3200;
  const rate = heroPlaybackRate(slide);
  const trimmed = heroTrimDurationSec(slide);
  if (trimmed != null && trimmed > 0) {
    return Math.min(16000, Math.max(4000, Math.round((trimmed / rate) * 1000)));
  }
  return Math.min(12000, Math.max(4800, Math.round(5600 / rate)));
}

export const HERO_MIN_TRIM_SEC = 0.4;
const MIN_TRIM_SEC = HERO_MIN_TRIM_SEC;

export function heroTrimWindow(
  slide: Pick<HeroSlide, "trimStartSec" | "trimEndSec">,
  durationSec?: number | null,
): { start: number; end: number | null } {
  const start = Math.max(0, Number(slide.trimStartSec) || 0);
  let end =
    slide.trimEndSec == null || !Number.isFinite(Number(slide.trimEndSec))
      ? null
      : Math.max(0, Number(slide.trimEndSec));
  const cap = durationSec && durationSec > 0 ? durationSec : null;
  let s = cap != null ? Math.min(start, Math.max(0, cap - MIN_TRIM_SEC)) : start;
  if (end != null) {
    if (cap != null) end = Math.min(end, cap);
    if (end < s + MIN_TRIM_SEC) end = s + MIN_TRIM_SEC;
    if (cap != null && end > cap) {
      end = cap;
      s = Math.max(0, end - MIN_TRIM_SEC);
    }
  }
  return { start: s, end };
}

export function heroTrimDurationSec(
  slide: Pick<HeroSlide, "trimStartSec" | "trimEndSec">,
  durationSec?: number | null,
): number | null {
  const { start, end } = heroTrimWindow(slide, durationSec);
  if (end == null) return durationSec != null ? Math.max(0, durationSec - start) : null;
  return Math.max(0, end - start);
}

export function formatHeroTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `hero-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `hero-${Date.now().toString(36)}`;
}

export function normalizeHeroSlide(raw: unknown): HeroSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<HeroSlide> & { kind?: string };
  const src = typeof data.src === "string" ? data.src.trim() : "";
  if (!src || !isAllowedHeroImageUrl(src)) return null;
  const alt =
    typeof data.alt === "string" && data.alt.trim()
      ? data.alt.trim().slice(0, 200)
      : "Athlete training at The Train Station";
  const objectPosition =
    typeof data.objectPosition === "string" && data.objectPosition.trim()
      ? data.objectPosition.trim().slice(0, 80)
      : "center 22%";
  const parsed = parseObjectPosition(objectPosition);
  const kind: HeroSlideKind =
    data.kind === "video" || data.kind === "image"
      ? data.kind
      : isHeroVideoSrc(src)
        ? "video"
        : "image";
  const focusX = clamp(
    typeof data.focusX === "number" ? data.focusX : parsed.focusX,
    0,
    100,
  );
  const focusY = clamp(
    typeof data.focusY === "number" ? data.focusY : parsed.focusY,
    0,
    100,
  );
  const zoom = clamp(
    typeof data.zoom === "number" ? data.zoom : 1,
    HERO_ZOOM_MIN,
    HERO_ZOOM_MAX,
  );
  const playbackRate = clamp(
    typeof data.playbackRate === "number" ? data.playbackRate : 1,
    0.25,
    1,
  );
  const trimStartSec = Math.max(
    0,
    typeof data.trimStartSec === "number" ? data.trimStartSec : 0,
  );
  const rawEnd = data.trimEndSec;
  const trimEndSec =
    rawEnd == null || rawEnd === 0 || !Number.isFinite(Number(rawEnd))
      ? null
      : Math.max(trimStartSec + MIN_TRIM_SEC, Number(rawEnd));
  const id =
    typeof data.id === "string" && data.id.trim()
      ? data.id.trim().slice(0, 80)
      : newId();
  return {
    id,
    src,
    alt,
    objectPosition: objectPositionFromFocus(focusX, focusY),
    enabled: data.enabled !== false,
    kind,
    focusX,
    focusY,
    zoom,
    playbackRate: kind === "video" ? playbackRate : 1,
    trimStartSec: kind === "video" ? trimStartSec : 0,
    trimEndSec: kind === "video" ? trimEndSec : null,
  };
}

export function normalizeHeroSlides(raw: unknown): HeroSlide[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_HERO_SLIDES.map((s) => ({ ...s }));
  }
  const out: HeroSlide[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const slide = normalizeHeroSlide(entry);
    if (!slide) continue;
    let id = slide.id;
    if (seen.has(id)) id = newId();
    seen.add(id);
    out.push({ ...slide, id });
    if (out.length >= HERO_SLIDE_MAX) break;
  }
  if (out.length === 0) return DEFAULT_HERO_SLIDES.map((s) => ({ ...s }));
  return applyDefaultHeroFraming(out);
}

/** Public carousel — only enabled slides with valid src. */
export function activeHeroSlides(slides: HeroSlide[] | null | undefined): HeroSlide[] {
  const list = slides?.length ? slides : DEFAULT_HERO_SLIDES;
  const active = applyDefaultHeroFraming(list.filter((s) => s.enabled && s.src));
  return active.length ? active : DEFAULT_HERO_SLIDES.filter((s) => s.enabled);
}

export function createEmptyHeroSlide(src = ""): HeroSlide {
  return {
    id: newId(),
    src,
    alt: "Athlete training at The Train Station",
    objectPosition: "50% 22%",
    enabled: true,
    kind: isHeroVideoSrc(src) ? "video" : "image",
    focusX: 50,
    focusY: 22,
    zoom: 1,
    playbackRate: 1,
    trimStartSec: 0,
    trimEndSec: null,
  };
}
