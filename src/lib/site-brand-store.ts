import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import {
  DEFAULT_LOGO_TRANSFORM,
  normalizeLogoTransform,
  type LogoTransform,
} from "@/lib/logo-transform";

export type SiteBrandConfig = {
  brandName: string;
  brandTagline: string;
  logoUrl: string | null;
  logoIconUrl: string | null;
  faviconUrl: string | null;
  logoSourceUrl: string | null;
  logoTransform: LogoTransform;
  updatedAt: string;
};

export type { LogoTransform };

const DEV_FILE = path.join(process.cwd(), "prisma", "site-brand.dev.json");
const BLOB_PATH = "demo/site-brand.json";

let memoryStore: SiteBrandConfig | null = null;

function emptyConfig(): SiteBrandConfig {
  return {
    brandName: BRAND_NAME,
    brandTagline: BRAND_TAGLINE,
    logoUrl: null,
    logoIconUrl: null,
    faviconUrl: null,
    logoSourceUrl: null,
    logoTransform: { ...DEFAULT_LOGO_TRANSFORM },
    updatedAt: new Date().toISOString(),
  };
}

function normalizeText(raw: unknown, fallback: string, maxLen: number): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

function normalize(raw: unknown): SiteBrandConfig {
  if (!raw || typeof raw !== "object") return emptyConfig();
  const data = raw as Partial<SiteBrandConfig>;
  return {
    brandName: normalizeText(data.brandName, BRAND_NAME, 80),
    brandTagline: normalizeText(data.brandTagline, BRAND_TAGLINE, 200),
    logoUrl: normalizeUrl(data.logoUrl),
    logoIconUrl: normalizeUrl(data.logoIconUrl),
    faviconUrl: normalizeUrl(data.faviconUrl),
    logoSourceUrl: normalizeUrl(data.logoSourceUrl),
    logoTransform: normalizeLogoTransform(data.logoTransform),
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isSitePath(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

function assertBrandAssetUrl(url: string | null, label: string) {
  if (!url) return;
  if (isSitePath(url) || isHttpUrl(url)) return;
  throw new Error(`${label} must be a site path (/images/…) or https URL.`);
}

export async function getSiteBrand(): Promise<SiteBrandConfig> {
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

export async function saveSiteBrand(
  patch: Partial<
    Pick<
      SiteBrandConfig,
      | "brandName"
      | "brandTagline"
      | "logoUrl"
      | "logoIconUrl"
      | "faviconUrl"
      | "logoSourceUrl"
      | "logoTransform"
    >
  >,
): Promise<SiteBrandConfig> {
  const current = await getSiteBrand();
  const next: SiteBrandConfig = {
    ...current,
    updatedAt: new Date().toISOString(),
  };

  if (patch.brandName !== undefined) {
    next.brandName = normalizeText(patch.brandName, BRAND_NAME, 80);
  }
  if (patch.brandTagline !== undefined) {
    next.brandTagline = normalizeText(patch.brandTagline, BRAND_TAGLINE, 200);
  }
  if (patch.logoUrl !== undefined) {
    const url = patch.logoUrl?.trim() || null;
    assertBrandAssetUrl(url, "Logo");
    next.logoUrl = url;
  }
  if (patch.logoIconUrl !== undefined) {
    const url = patch.logoIconUrl?.trim() || null;
    assertBrandAssetUrl(url, "Logo icon");
    next.logoIconUrl = url;
  }
  if (patch.faviconUrl !== undefined) {
    const url = patch.faviconUrl?.trim() || null;
    assertBrandAssetUrl(url, "Favicon");
    next.faviconUrl = url;
  }
  if (patch.logoSourceUrl !== undefined) {
    const url = patch.logoSourceUrl?.trim() || null;
    assertBrandAssetUrl(url, "Logo source");
    next.logoSourceUrl = url;
  }
  if (patch.logoTransform !== undefined) {
    next.logoTransform = normalizeLogoTransform(patch.logoTransform);
  }

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