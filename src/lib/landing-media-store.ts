import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import type { MembershipPlan } from "@/lib/signup-plans";
import { MEMBERSHIP_PLANS } from "@/lib/signup-plans";
import {
  clampVolumeDb,
  DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
} from "@/lib/media-volume";
import {
  DEFAULT_HERO_SLIDES,
  HERO_SLIDE_MAX,
  HERO_SLIDE_MIN,
  normalizeHeroSlides,
  type HeroSlide,
} from "@/lib/hero-slides";
import { isAllowedCoachIntroVideoUrl, isDirectVideoUrl } from "@/lib/site-video";
import { isYoutubeUrl } from "@/lib/youtube";

/** Product defaults — same files as Free ticket, served from this app. */
const DEFAULT_WELCOME_FILE = "/videos/jeremy-welcome.mp4";
const DEFAULT_FREE_INTRO_FILE = "/videos/jeremy-free-intro.mp4";

function isUsableIntroFile(url: string | null): url is string {
  if (!url) return false;
  if (isYoutubeUrl(url)) return false;
  if (/dQw4w9WgXcQ|rick.?roll/i.test(url)) return false;
  return isDirectVideoUrl(url);
}

export type WelcomeVideosByPlan = Partial<Record<MembershipPlan, string | null>>;
export type { HeroSlide };

export type LandingMediaConfig = {
  welcomeVideoUrl: string | null;
  welcomeVideosByPlan: WelcomeVideosByPlan;
  freeChastiseVideoUrl: string | null;
  /**
   * Cold landing hero carousel (Admin → Landing → Hero images).
   * Order = play order. More than 4 allowed.
   */
  heroSlides: HeroSlide[];
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
   * Upload under Admin → Videos (site file only — no YouTube).
   */
  equipmentIntroVideoUrl: string | null;
  /**
   * First visit to member Measurements — how to take tape / scale measurements.
   * Upload under Admin → Videos.
   */
  measurementsIntroVideoUrl: string | null;
  /**
   * Relative volume for uploaded coach intros / free intro / gear intro (HTML5 files).
   * Multiples of 3 dB from native (0). Default +6 dB (louder intros).
   */
  uploadedContentVolumeDb: number;
  venmoQrUrl: string | null;
  venmoHandle: string | null;
  venmoInstructions: string | null;
  /** Concat output (5s gag + current Free Explorer intro). Blob or /videos/…. */
  freeTicketFullUrl: string | null;
  freeTicketFullBuiltAt: string | null;
  freeTicketFullIntroSource: string | null;
  freeTicketFullStatus: "idle" | "queued" | "running" | "ok" | "error";
  freeTicketFullError: string | null;
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
    if (typeof value === "string" && isUsableIntroFile(value.trim())) {
      out[plan] = value.trim();
    }
  }
  return out;
}

function emptyConfig(): LandingMediaConfig {
  return {
    welcomeVideoUrl: DEFAULT_WELCOME_FILE,
    welcomeVideosByPlan: { explorer: DEFAULT_FREE_INTRO_FILE },
    freeChastiseVideoUrl: DEFAULT_FREE_INTRO_FILE,
    heroSlides: DEFAULT_HERO_SLIDES.map((s) => ({ ...s })),
    gagVideoUrl: null,
    gagStartSec: 43,
    gagDurationSec: 5,
    gagEnabled: true,
    purchaseThankYouVideoUrl: null,
    equipmentIntroVideoUrl: null,
    measurementsIntroVideoUrl: null,
    uploadedContentVolumeDb: DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
    venmoQrUrl: null,
    venmoHandle: null,
    venmoInstructions: null,
    freeTicketFullUrl: null,
    freeTicketFullBuiltAt: null,
    freeTicketFullIntroSource: null,
    freeTicketFullStatus: "idle",
    freeTicketFullError: null,
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

function storedIntroOrDefault(raw: unknown, fallback: string): string {
  const url = normalizeUrl(raw);
  return isUsableIntroFile(url) ? url : fallback;
}

function storedIntroOrNull(raw: unknown): string | null {
  const url = normalizeUrl(raw);
  return isUsableIntroFile(url) ? url : null;
}

function normalize(raw: unknown): LandingMediaConfig {
  if (!raw || typeof raw !== "object") return emptyConfig();
  const data = raw as Partial<LandingMediaConfig> & { gagEnabled?: unknown };
  const defaults = emptyConfig();
  const byPlan = normalizeWelcomeVideosByPlan(data.welcomeVideosByPlan);
  const free = storedIntroOrDefault(
    data.freeChastiseVideoUrl || byPlan.explorer,
    DEFAULT_FREE_INTRO_FILE,
  );
  return {
    welcomeVideoUrl: storedIntroOrDefault(data.welcomeVideoUrl, DEFAULT_WELCOME_FILE),
    welcomeVideosByPlan: { ...byPlan, explorer: free },
    freeChastiseVideoUrl: free,
    heroSlides: normalizeHeroSlides(
      (data as { heroSlides?: unknown }).heroSlides ?? DEFAULT_HERO_SLIDES,
    ),
    gagVideoUrl: normalizeUrl(data.gagVideoUrl),
    gagStartSec: clampInt(data.gagStartSec, defaults.gagStartSec, 0, 3600),
    gagDurationSec: clampInt(data.gagDurationSec, defaults.gagDurationSec, 3, 60),
    gagEnabled: data.gagEnabled === false ? false : true,
    purchaseThankYouVideoUrl: normalizeUrl(data.purchaseThankYouVideoUrl),
    equipmentIntroVideoUrl: storedIntroOrNull(data.equipmentIntroVideoUrl),
    measurementsIntroVideoUrl: storedIntroOrNull(data.measurementsIntroVideoUrl),
    uploadedContentVolumeDb: clampVolumeDb(
      (data as { uploadedContentVolumeDb?: unknown }).uploadedContentVolumeDb,
      DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
    ),
    venmoQrUrl: normalizeUrl(data.venmoQrUrl),
    venmoHandle: normalizeUrl(data.venmoHandle),
    venmoInstructions: normalizeUrl(data.venmoInstructions),
    freeTicketFullUrl: normalizeUrl(data.freeTicketFullUrl),
    freeTicketFullBuiltAt:
      typeof data.freeTicketFullBuiltAt === "string" ? data.freeTicketFullBuiltAt : null,
    freeTicketFullIntroSource: normalizeUrl(data.freeTicketFullIntroSource),
    freeTicketFullStatus: parseJobStatus(data.freeTicketFullStatus),
    freeTicketFullError:
      typeof data.freeTicketFullError === "string" ? data.freeTicketFullError : null,
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

function parseJobStatus(raw: unknown): LandingMediaConfig["freeTicketFullStatus"] {
  if (raw === "queued" || raw === "running" || raw === "ok" || raw === "error" || raw === "idle") {
    return raw;
  }
  return "idle";
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
      | "heroSlides"
      | "gagVideoUrl"
      | "gagStartSec"
      | "gagDurationSec"
      | "gagEnabled"
      | "purchaseThankYouVideoUrl"
      | "equipmentIntroVideoUrl"
      | "measurementsIntroVideoUrl"
      | "uploadedContentVolumeDb"
      | "venmoQrUrl"
      | "venmoHandle"
      | "venmoInstructions"
      | "freeTicketFullUrl"
      | "freeTicketFullBuiltAt"
      | "freeTicketFullIntroSource"
      | "freeTicketFullStatus"
      | "freeTicketFullError"
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
        "Welcome video must be an uploaded coach intro (MP4/WebM/MOV) on this site.",
      );
    }
    next.welcomeVideoUrl = url || DEFAULT_WELCOME_FILE;
  }

  if (patch.welcomeVideosByPlan !== undefined) {
    const normalized = normalizeWelcomeVideosByPlan(patch.welcomeVideosByPlan);
    for (const plan of MEMBERSHIP_PLANS) {
      const url = normalized[plan];
      if (url && !isAllowedCoachIntroVideoUrl(url)) {
        throw new Error(
          `${plan} welcome video must be an uploaded file on this site.`,
        );
      }
    }
    next.welcomeVideosByPlan = {
      ...normalized,
      explorer: normalized.explorer || next.freeChastiseVideoUrl || DEFAULT_FREE_INTRO_FILE,
    };
  }

  if (patch.freeChastiseVideoUrl !== undefined) {
    const url = patch.freeChastiseVideoUrl?.trim() || null;
    if (url && !isAllowedCoachIntroVideoUrl(url)) {
      throw new Error(
        "Free-ticket intro must be an uploaded file on this site.",
      );
    }
    next.freeChastiseVideoUrl = url || DEFAULT_FREE_INTRO_FILE;
    next.welcomeVideosByPlan = {
      ...next.welcomeVideosByPlan,
      explorer: next.freeChastiseVideoUrl,
    };
  }

  if (patch.heroSlides !== undefined) {
    const slides = normalizeHeroSlides(patch.heroSlides);
    if (slides.length < HERO_SLIDE_MIN) {
      throw new Error(`Keep at least ${HERO_SLIDE_MIN} hero image.`);
    }
    if (slides.length > HERO_SLIDE_MAX) {
      throw new Error(`At most ${HERO_SLIDE_MAX} hero images.`);
    }
    const enabled = slides.filter((s) => s.enabled && s.src);
    if (enabled.length < 1) {
      throw new Error("Enable at least one hero image with a valid file or URL.");
    }
    next.heroSlides = slides;
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
    next.gagDurationSec = clampInt(patch.gagDurationSec, 5, 3, 60);
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
        "Equipment intro must be an uploaded coach intro (MP4/WebM/MOV) on this site.",
      );
    }
    next.equipmentIntroVideoUrl = url;
  }

  if (patch.measurementsIntroVideoUrl !== undefined) {
    const url = patch.measurementsIntroVideoUrl?.trim() || null;
    if (url && !isAllowedCoachIntroVideoUrl(url)) {
      throw new Error(
        "Measurements how-to must be an uploaded coach intro (MP4/WebM/MOV) on this site.",
      );
    }
    next.measurementsIntroVideoUrl = url;
  }

  if (patch.uploadedContentVolumeDb !== undefined) {
    next.uploadedContentVolumeDb = clampVolumeDb(
      patch.uploadedContentVolumeDb,
      DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
    );
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

  if (patch.freeTicketFullUrl !== undefined) {
    next.freeTicketFullUrl = patch.freeTicketFullUrl?.trim() || null;
  }
  if (patch.freeTicketFullBuiltAt !== undefined) {
    next.freeTicketFullBuiltAt = patch.freeTicketFullBuiltAt;
  }
  if (patch.freeTicketFullIntroSource !== undefined) {
    next.freeTicketFullIntroSource = patch.freeTicketFullIntroSource?.trim() || null;
  }
  if (patch.freeTicketFullStatus !== undefined) {
    next.freeTicketFullStatus = patch.freeTicketFullStatus;
  }
  if (patch.freeTicketFullError !== undefined) {
    next.freeTicketFullError = patch.freeTicketFullError;
  }

  const introChanged =
    patch.freeChastiseVideoUrl !== undefined &&
    current.freeChastiseVideoUrl !== next.freeChastiseVideoUrl;
  if (introChanged) {
    next.freeTicketFullStatus = "queued";
    next.freeTicketFullError = null;
    next.freeTicketFullIntroSource = next.freeChastiseVideoUrl;
  }

  const { blobSaved } = await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: next,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
  });
  requireBlobPersisted(blobSaved, "Landing videos");

  if (introChanged && next.freeChastiseVideoUrl) {
    const introUrl = next.freeChastiseVideoUrl;
    void import("@/lib/free-ticket-full-job")
      .then((job) =>
        job.triggerRebuildFreeTicketFull({
          introUrl,
          reason: "free-intro-changed",
        }),
      )
      .catch((err) => {
        console.warn("free-ticket-full rebuild trigger failed", err);
      });
  }

  return next;
}