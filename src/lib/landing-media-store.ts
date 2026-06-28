import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import type { MembershipPlan } from "@/lib/signup-plans";
import { MEMBERSHIP_PLANS } from "@/lib/signup-plans";
import { isYoutubeUrl } from "@/lib/youtube";

export type WelcomeVideosByPlan = Partial<Record<MembershipPlan, string | null>>;

export type LandingMediaConfig = {
  welcomeVideoUrl: string | null;
  welcomeVideosByPlan: WelcomeVideosByPlan;
  freeChastiseVideoUrl: string | null;
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

function normalize(raw: unknown): LandingMediaConfig {
  if (!raw || typeof raw !== "object") return emptyConfig();
  const data = raw as Partial<LandingMediaConfig>;
  return {
    welcomeVideoUrl: normalizeUrl(data.welcomeVideoUrl),
    welcomeVideosByPlan: normalizeWelcomeVideosByPlan(data.welcomeVideosByPlan),
    freeChastiseVideoUrl: normalizeUrl(data.freeChastiseVideoUrl),
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
    if (url && !isYoutubeUrl(url)) {
      throw new Error("Welcome video must be a valid YouTube URL.");
    }
    next.welcomeVideoUrl = url;
  }

  if (patch.welcomeVideosByPlan !== undefined) {
    const normalized = normalizeWelcomeVideosByPlan(patch.welcomeVideosByPlan);
    for (const plan of MEMBERSHIP_PLANS) {
      const url = normalized[plan];
      if (url && !isYoutubeUrl(url)) {
        throw new Error(`${plan} welcome video must be a valid YouTube URL.`);
      }
    }
    next.welcomeVideosByPlan = normalized;
  }

  if (patch.freeChastiseVideoUrl !== undefined) {
    const url = patch.freeChastiseVideoUrl?.trim() || null;
    if (url && !isYoutubeUrl(url)) {
      throw new Error("Free-ticket video must be a valid YouTube URL.");
    }
    next.freeChastiseVideoUrl = url;
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