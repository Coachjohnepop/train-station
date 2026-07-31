/**
 * Cold-traffic landing hero carousel slides.
 * Managed under Admin → Landing → Hero images.
 */

export type HeroSlide = {
  id: string;
  /** Site path (/images/…) or https Blob URL */
  src: string;
  alt: string;
  /**
   * CSS object-position (e.g. "center 22%"). Controls crop framing on tall phones.
   */
  objectPosition: string;
  /** When false, slide is skipped on the public site but kept for re-enable. */
  enabled: boolean;
};

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    id: "hero-black-guy",
    src: "/images/splash/black-guy.jpg",
    alt: "Athlete powering through a heavy lift",
    objectPosition: "center 22%",
    enabled: true,
  },
  {
    id: "hero-blonde-girl",
    src: "/images/splash/blonde-girl.jpg",
    alt: "Athlete on cable lat pulldowns in Train Station gear",
    objectPosition: "center 22%",
    enabled: true,
  },
  {
    id: "hero-hispanic-split",
    src: "/images/splash/hispanic-split-squat.jpg",
    alt: "Athlete hitting Bulgarian split squats",
    objectPosition: "center 22%",
    enabled: true,
  },
  {
    id: "hero-asian-woman",
    src: "/images/splash/asian-woman.jpg",
    alt: "Athlete in an intense training session",
    objectPosition: "center 22%",
    enabled: true,
  },
];

export const HERO_SLIDE_MIN = 1;
export const HERO_SLIDE_MAX = 24;
/** Max upload size for a single hero image (client + server). */
export const HERO_IMAGE_MAX_BYTES = 12 * 1024 * 1024;

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|avif)(?:$|\?)/i;

export function isAllowedHeroImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const t = url.trim();
  if (t.startsWith("/images/") || t.startsWith("/uploads/")) return true;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (/\.public\.blob\.vercel-storage\.com$/i.test(u.hostname)) return true;
    if (IMAGE_EXT_RE.test(u.pathname)) return true;
    return true; // allow CDN paths without extension
  } catch {
    return false;
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `hero-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `hero-${Date.now().toString(36)}`;
}

export function normalizeHeroSlide(raw: unknown): HeroSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<HeroSlide>;
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
  const id =
    typeof data.id === "string" && data.id.trim()
      ? data.id.trim().slice(0, 80)
      : newId();
  return {
    id,
    src,
    alt,
    objectPosition,
    enabled: data.enabled !== false,
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
  return out;
}

/** Public carousel — only enabled slides with valid src. */
export function activeHeroSlides(slides: HeroSlide[] | null | undefined): HeroSlide[] {
  const list = slides?.length ? slides : DEFAULT_HERO_SLIDES;
  const active = list.filter((s) => s.enabled && s.src);
  return active.length ? active : DEFAULT_HERO_SLIDES.filter((s) => s.enabled);
}

export function createEmptyHeroSlide(src = ""): HeroSlide {
  return {
    id: newId(),
    src,
    alt: "Athlete training at The Train Station",
    objectPosition: "center 22%",
    enabled: true,
  };
}
