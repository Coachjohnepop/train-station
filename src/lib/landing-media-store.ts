import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import type { MembershipPlan } from "@/lib/signup-plans";
import { MEMBERSHIP_PLANS } from "@/lib/signup-plans";
import { isAllowedCoachIntroVideoUrl } from "@/lib/site-video";
import { isYoutubeUrl } from "@/lib/youtube";

export type WelcomeVideosByPlan = Partial<Record<MembershipPlan, string | null>>;

export type LandingMediaConfig = {
  welcomeVideoUrl: string | null;
  welcomeVideosByPlan: WelcomeVideosByPlan;
  freeChastiseVideoUrl: string | null;
  /**
   * Free-ticket gag (default Rick Astley). Empty = built-in default URL.
   * Played ~gagDurationSec from gagStartSec, then crossfades to free-ticket intro.
   */
  gagVideoUrl: string | null;
  /** Seconds into gag video to start (chorus). Default 43. */
  gagStartSec: number;
  /** How long gag plays before Jeremy intro. Default 10. */
  gagDurationSec: number;
  /** When false, skip gag and go straight to free-ticket intro. */
  gagEnabled: boolean;
  /** After paid checkout success — “thank you for the purchase”. */
  purchaseThankYouVideoUrl: string | null;
  /**
   * First visit to member Gear / equipment — Jeremy explains home gym buying.
   * Upload under Admin → Videos or paste YouTube / library URL.
   */
  equipmentIntroVideoUrl: string | null;
  venmoQrUrl: string | null;
  venmoHandle: string | null;
  venmoInstructions: string | null;
  updatedAt: string;
};

const DEV_FILE = path.join(process.cwd(), "prisma", "landing-media.dev.json");
const BLOB_PATH = "demo/landing-media.json";

let memoryStore: LandingMediaConfig | null = null;

function normalizeWelcomeVideosByPlan(raw: unknown): WelcomeVideosByPlan {
  if (!raw || typeof raw !== "object") return {};
  const data = raw as Record<string, unknown>;
  const out: WelcomeVideosByPlan = {};
  for (const plan of MEMBERSHIP_PLANS) {
    const value = data[plan];
    if (typeof value === "string" && value.trim()) out[plan] = value.trim();
  }
  return out;
}

function emptyConfig(): LandingMediaConfig {
  return {
    welcomeVideoUrl: null,
    welcomeVideosByPlan: {},
    freeChastiseVideoUrl: null,
    gagVideoUrl: null,
    gagStartSec: 43,
    gagDurationSec: 10,
    gagEnabled: true,
    purchaseThankYouVideoUrl: null,
    equipmentIntroVideoUrl: null,
    venmoQrUrl: null,
    venmoHandle: null,
    venmoInstructions: null,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalize(raw: unknown): LandingMediaConfig {
  if (!raw || typeof raw !== "object") return emptyConfig();
  const data = raw as Partial<LandingMediaConfig> & { gagEnabled?: unknown };
  const defaults = emptyConfig();
  return {
    welcomeVideoUrl: normalizeUrl(data.welcomeVideoUrl),
    welcomeVideosByPlan: normalizeWelcomeVideosByPlan(data.welcomeVideosByPlan),
    freeChastiseVideoUrl: normalizeUrl(data.freeChastiseVideoUrl),
    gagVideoUrl: normalizeUrl(data.gagVideoUrl),
    gagStartSec: clampInt(data.gagStartSec, defaults.gagStartSec, 0, 3600),
    gagDurationSec: clampInt(data.gagDurationSec, defaults.gagDurationSec, 3, 60),
    gagEnabled: data.gagEnabled === false ? false : true,
    purchaseThankYouVideoUrl: normalizeUrl(data.purchaseThankYouVideoUrl),
    equipmentIntroVideoUrl: normalizeUrl(data.equipmentIntroVideoUrl),
    venmoQrUrl: normalizeUrl(data.venmoQrUrl),
    venmoHandle: normalizeUrl(data.venmoHandle),
    venmoInstructions: normalizeUrl(data.venmoInstructions),
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

export async function getLandingMedia(): Promise<LandingMediaConfig> {
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

export async function saveLandingMedia(
  patch: Partial<
    Pick<
      LandingMediaConfig,
      | "welcomeVideoUrl"
      | "welcomeVideosByPlan"
      | "freeChastiseVideoUrl"
      | "gagVideoUrl"
      | "gagStartSec"
      | "gagDurationSec"
      | "gagEnabled"
      | "purchaseThankYouVideoUrl"
      | "equipmentIntroVideoUrl"
      | "venmoQrUrl"
      | "venmoHandle"
      | "venmoInstructions"
    >
  >,
): Promise<LandingMediaConfig> {
  const current = await getLandingMedia();
  const next: LandingMediaConfig = {
    ...current,
    updatedAt: new Date().toISOString(),
  };

  if (patch.welcomeVideoUrl !== undefined) {
    const url = patch.welcomeVideoUrl?.trim() || null;
    if (url && !isAllowedCoachIntroVideoUrl(url)) {
      throw new Error(
        "Welcome video must be an uploaded coach intro (MP4/WebM/MOV) or a YouTube URL.",
      );
    }
    next.welcomeVideoUrl = url;
  }

  if (patch.welcomeVideosByPlan !== undefined) {
    const normalized = normalizeWelcomeVideosByPlan(patch.welcomeVideosByPlan);
    for (const plan of MEMBERSHIP_PLANS) {
      const url = normalized[plan];
      if (url && !isAllowedCoachIntroVideoUrl(url)) {
        throw new Error(
          `${plan} welcome video must be an uploaded file or a YouTube URL.`,
        );
      }
    }
    next.welcomeVideosByPlan = normalized;
  }

  if (patch.freeChastiseVideoUrl !== undefined) {
    const url = patch.freeChastiseVideoUrl?.trim() || null;
    if (url && !isAllowedCoachIntroVideoUrl(url)) {
      throw new Error(
        "Free-ticket intro must be an uploaded file or a YouTube URL.",
      );
    }
    next.freeChastiseVideoUrl = url;
  }

  if (patch.gagVideoUrl !== undefined) {
    const url = patch.gagVideoUrl?.trim() || null;
    if (url && !isYoutubeUrl(url)) {
      throw new Error("Gag video must be a valid YouTube URL.");
    }
    next.gagVideoUrl = url;
  }

  if (patch.gagStartSec !== undefined) {
    next.gagStartSec = clampInt(patch.gagStartSec, 43, 0, 3600);
  }

  if (patch.gagDurationSec !== undefined) {
    next.gagDurationSec = clampInt(patch.gagDurationSec, 10, 3, 60);
  }

  if (patch.gagEnabled !== undefined) {
    next.gagEnabled = Boolean(patch.gagEnabled);
  }

  if (patch.purchaseThankYouVideoUrl !== undefined) {
    const url = patch.purchaseThankYouVideoUrl?.trim() || null;
    if (url && !isYoutubeUrl(url)) {
      throw new Error("Purchase thank-you video must be a valid YouTube URL.");
    }
    next.purchaseThankYouVideoUrl = url;
  }

  if (patch.equipmentIntroVideoUrl !== undefined) {
    const url = patch.equipmentIntroVideoUrl?.trim() || null;
    if (url && !isAllowedCoachIntroVideoUrl(url)) {
      throw new Error(
        "Equipment intro must be an uploaded coach intro (MP4/WebM/MOV) or a YouTube URL.",
      );
    }
    next.equipmentIntroVideoUrl = url;
  }

  if (patch.venmoQrUrl !== undefined) {
    const url = patch.venmoQrUrl?.trim() || null;
    if (url && !isHttpUrl(url)) {
      throw new Error("Venmo QR must be a valid image URL (https://…).");
    }
    next.venmoQrUrl = url;
  }

  if (patch.venmoHandle !== undefined) {
    next.venmoHandle = patch.venmoHandle?.trim() || null;
  }

  if (patch.venmoInstructions !== undefined) {
    next.venmoInstructions = patch.venmoInstructions?.trim() || null;
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