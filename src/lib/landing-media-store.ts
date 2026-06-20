import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { isYoutubeUrl } from "@/lib/youtube";

export type LandingMediaConfig = {
  welcomeVideoUrl: string | null;
  freeChastiseVideoUrl: string | null;
  updatedAt: string;
};

const DEV_FILE = path.join(process.cwd(), "prisma", "landing-media.dev.json");
const BLOB_PATH = "demo/landing-media.json";

let memoryStore: LandingMediaConfig | null = null;

function emptyConfig(): LandingMediaConfig {
  return {
    welcomeVideoUrl: null,
    freeChastiseVideoUrl: null,
    updatedAt: new Date().toISOString(),
  };
}

function normalize(raw: unknown): LandingMediaConfig {
  if (!raw || typeof raw !== "object") return emptyConfig();
  const data = raw as Partial<LandingMediaConfig>;
  return {
    welcomeVideoUrl:
      typeof data.welcomeVideoUrl === "string" && data.welcomeVideoUrl.trim()
        ? data.welcomeVideoUrl.trim()
        : null,
    freeChastiseVideoUrl:
      typeof data.freeChastiseVideoUrl === "string" && data.freeChastiseVideoUrl.trim()
        ? data.freeChastiseVideoUrl.trim()
        : null,
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
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
  patch: Partial<Pick<LandingMediaConfig, "welcomeVideoUrl" | "freeChastiseVideoUrl">>,
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

  if (patch.freeChastiseVideoUrl !== undefined) {
    const url = patch.freeChastiseVideoUrl?.trim() || null;
    if (url && !isYoutubeUrl(url)) {
      throw new Error("Free-ticket video must be a valid YouTube URL.");
    }
    next.freeChastiseVideoUrl = url;
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