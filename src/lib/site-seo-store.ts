import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";

/**
 * Site-wide SEO + social share settings (platform backoffice).
 * Stored like brand/landing media — Postgres later if needed; Blob/JSON is fine for metadata.
 */
export type SiteSeoConfig = {
  /** Browser tab + SERP title (default brand title if empty). */
  metaTitle: string;
  /** SERP snippet (recommended ~150–160 chars). */
  metaDescription: string;
  /** Open Graph / iMessage / social title. */
  ogTitle: string;
  /** Open Graph description. */
  ogDescription: string;
  /** Absolute URL or site path for share image. */
  ogImageUrl: string;
  /** Alt text for OG image. */
  ogImageAlt: string;
  /** Comma-separated keywords (low SEO weight; still useful for internal notes). */
  keywords: string;
  /** Allow search engines to index public pages. */
  robotsIndex: boolean;
  /** Allow following links. */
  robotsFollow: boolean;
  /** Optional Google Search Console verification token (content value only). */
  googleSiteVerification: string;
  /** Optional Bing / other verification meta content. */
  bingSiteVerification: string;
  updatedAt: string;
};

const DEV_FILE = path.join(process.cwd(), "prisma", "site-seo.dev.json");
const BLOB_PATH = "demo/site-seo.json";

const DEFAULTS: Omit<SiteSeoConfig, "updatedAt"> = {
  metaTitle: "The Train Station — Train with purpose",
  metaDescription:
    "Live coaching with Coach Jeremy. Real programs, real accountability. Free quick tour — then choose your ticket.",
  ogTitle: "The Train Station — Train with purpose",
  ogDescription:
    "Live coaching · real programs · on your phone. Free quick tour — then choose your ticket.",
  ogImageUrl: "/images/splash/black-guy.jpg",
  ogImageAlt: "Athlete training hard — The Train Station",
  keywords: "personal training, online coaching, strength, Jeremy Byrd, Train Station",
  robotsIndex: true,
  robotsFollow: true,
  googleSiteVerification: "",
  bingSiteVerification: "",
};

let memoryStore: SiteSeoConfig | null = null;

function emptyConfig(): SiteSeoConfig {
  return {
    ...DEFAULTS,
    updatedAt: new Date().toISOString(),
  };
}

function clampText(raw: unknown, max: number, fallback = ""): string {
  if (typeof raw !== "string") return fallback;
  const t = raw.trim();
  if (!t) return fallback;
  return t.length > max ? t.slice(0, max) : t;
}

function normalizeUrl(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const t = raw.trim();
  if (!t) return fallback;
  if (t.startsWith("/") && !t.startsWith("//")) return t.slice(0, 500);
  try {
    const u = new URL(t);
    if (u.protocol === "http:" || u.protocol === "https:") return t.slice(0, 500);
  } catch {
    /* ignore */
  }
  return fallback;
}

function normalize(raw: unknown): SiteSeoConfig {
  if (!raw || typeof raw !== "object") return emptyConfig();
  const data = raw as Partial<SiteSeoConfig>;
  return {
    metaTitle: clampText(data.metaTitle, 120, DEFAULTS.metaTitle),
    metaDescription: clampText(data.metaDescription, 320, DEFAULTS.metaDescription),
    ogTitle: clampText(data.ogTitle, 120, DEFAULTS.ogTitle),
    ogDescription: clampText(data.ogDescription, 320, DEFAULTS.ogDescription),
    ogImageUrl: normalizeUrl(data.ogImageUrl, DEFAULTS.ogImageUrl),
    ogImageAlt: clampText(data.ogImageAlt, 200, DEFAULTS.ogImageAlt),
    keywords: clampText(data.keywords, 400, DEFAULTS.keywords),
    robotsIndex: data.robotsIndex !== false,
    robotsFollow: data.robotsFollow !== false,
    googleSiteVerification: clampText(data.googleSiteVerification, 120, ""),
    bingSiteVerification: clampText(data.bingSiteVerification, 120, ""),
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

export function siteSeoDefaults(): SiteSeoConfig {
  return emptyConfig();
}

export async function getSiteSeo(): Promise<SiteSeoConfig> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
    fallback: emptyConfig,
  });
  const config = normalize(hydrated);
  memoryStore = config;
  return config;
}

export type SiteSeoPatch = Partial<
  Pick<
    SiteSeoConfig,
    | "metaTitle"
    | "metaDescription"
    | "ogTitle"
    | "ogDescription"
    | "ogImageUrl"
    | "ogImageAlt"
    | "keywords"
    | "robotsIndex"
    | "robotsFollow"
    | "googleSiteVerification"
    | "bingSiteVerification"
  >
>;

export async function saveSiteSeo(patch: SiteSeoPatch): Promise<SiteSeoConfig> {
  const current = await getSiteSeo();
  const next = normalize({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: next,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
  });

  return next;
}

export function absoluteSeoUrl(pathOrUrl: string, origin: string): string {
  const base = origin.replace(/\/$/, "");
  if (!pathOrUrl) return base;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  return `${base}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** Public pages we always want in the sitemap when indexing is on. */
export const SEO_PUBLIC_PATHS: Array<{
  path: string;
  changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/join", changeFrequency: "weekly", priority: 0.95 },
  { path: "/free", changeFrequency: "weekly", priority: 0.9 },
  { path: "/powered-by", changeFrequency: "monthly", priority: 0.4 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];
