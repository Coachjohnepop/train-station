import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import { isYoutubeUrl } from "@/lib/youtube";

export type NutritionCalorieTier = {
  id: string;
  calories: number;
  label: string;
  sampleDay: string;
};

/** Daily / library inspirational clips for member Today (and Video admin). */
export type DailyInspirationClip = {
  id: string;
  title: string;
  videoUrl: string;
  /** 0 = Sunday … 6 = Saturday; null = any day / general library */
  weekday: number | null;
};

export type MemberContentConfig = {
  weeklyVideoUrl: string | null;
  weeklyVideoTitle: string;
  dinnerVideoUrl: string | null;
  dinnerVideoTitle: string;
  dailyInspirationClips: DailyInspirationClip[];
  nutritionIntro: string;
  nutritionTiers: NutritionCalorieTier[];
  updatedAt: string;
};

const DEV_FILE = path.join(process.cwd(), "prisma", "member-content.dev.json");
const BLOB_PATH = "demo/member-content.json";

let memoryStore: MemberContentConfig | null = null;

export const DEFAULT_NUTRITION_TIERS: NutritionCalorieTier[] = [
  {
    id: "tier-1600",
    calories: 1600,
    label: "1,600 cal — lighter day",
    sampleDay:
      "Breakfast: Greek yogurt + berries · Lunch: grilled chicken salad · Dinner: fish + vegetables · Snacks: apple, almonds",
  },
  {
    id: "tier-2000",
    calories: 2000,
    label: "2,000 cal — maintenance",
    sampleDay:
      "Breakfast: eggs + toast · Lunch: turkey wrap · Dinner: lean protein + rice + greens · Snacks: protein shake",
  },
  {
    id: "tier-2500",
    calories: 2500,
    label: "2,500 cal — training day",
    sampleDay:
      "Breakfast: oatmeal + eggs · Lunch: chicken bowl · Dinner: steak + potato + salad · Snacks: cottage cheese, banana",
  },
];

function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

function normalizeTiers(raw: unknown): NutritionCalorieTier[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_NUTRITION_TIERS;
  const out: NutritionCalorieTier[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Partial<NutritionCalorieTier>;
    const calories = typeof r.calories === "number" ? r.calories : Number(r.calories);
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const sampleDay = typeof r.sampleDay === "string" ? r.sampleDay.trim() : "";
    if (!Number.isFinite(calories) || !label) continue;
    out.push({
      id: typeof r.id === "string" && r.id.trim() ? r.id.trim() : `tier-${calories}`,
      calories: Math.max(800, Math.min(6000, Math.round(calories))),
      label,
      sampleDay,
    });
  }
  return out.length > 0 ? out : DEFAULT_NUTRITION_TIERS;
}

function emptyConfig(): MemberContentConfig {
  return {
    weeklyVideoUrl: null,
    weeklyVideoTitle: "This week from Coach Jeremy",
    dinnerVideoUrl: null,
    dinnerVideoTitle: "What's for dinner?",
    dailyInspirationClips: [],
    nutritionIntro:
      "Sample day templates by calorie level — swap foods to match what you like. Your coach can personalize these on your intro call.",
    nutritionTiers: DEFAULT_NUTRITION_TIERS,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeClips(raw: unknown): DailyInspirationClip[] {
  if (!Array.isArray(raw)) return [];
  const out: DailyInspirationClip[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Partial<DailyInspirationClip>;
    const videoUrl = typeof r.videoUrl === "string" ? r.videoUrl.trim() : "";
    if (!videoUrl) continue;
    if (!isYoutubeUrl(videoUrl)) continue;
    const title =
      typeof r.title === "string" && r.title.trim() ? r.title.trim() : "Daily inspiration";
    let weekday: number | null = null;
    if (r.weekday !== null && r.weekday !== undefined) {
      const w = typeof r.weekday === "number" ? r.weekday : Number(r.weekday);
      if (Number.isFinite(w) && w >= 0 && w <= 6) weekday = Math.round(w);
    }
    out.push({
      id:
        typeof r.id === "string" && r.id.trim()
          ? r.id.trim()
          : `insp-${out.length + 1}-${Date.now().toString(36)}`,
      title,
      videoUrl,
      weekday,
    });
  }
  return out;
}

function normalize(raw: unknown): MemberContentConfig {
  if (!raw || typeof raw !== "object") return emptyConfig();
  const data = raw as Partial<MemberContentConfig>;
  return {
    weeklyVideoUrl: normalizeUrl(data.weeklyVideoUrl),
    weeklyVideoTitle:
      typeof data.weeklyVideoTitle === "string" && data.weeklyVideoTitle.trim()
        ? data.weeklyVideoTitle.trim()
        : emptyConfig().weeklyVideoTitle,
    dinnerVideoUrl: normalizeUrl(data.dinnerVideoUrl),
    dinnerVideoTitle:
      typeof data.dinnerVideoTitle === "string" && data.dinnerVideoTitle.trim()
        ? data.dinnerVideoTitle.trim()
        : emptyConfig().dinnerVideoTitle,
    dailyInspirationClips: normalizeClips(data.dailyInspirationClips),
    nutritionIntro:
      typeof data.nutritionIntro === "string" ? data.nutritionIntro.trim() : emptyConfig().nutritionIntro,
    nutritionTiers: normalizeTiers(data.nutritionTiers),
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

export async function getMemberContent(): Promise<MemberContentConfig> {
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

export async function saveMemberContent(
  patch: Partial<
    Pick<
      MemberContentConfig,
      | "weeklyVideoUrl"
      | "weeklyVideoTitle"
      | "dinnerVideoUrl"
      | "dinnerVideoTitle"
      | "dailyInspirationClips"
      | "nutritionIntro"
      | "nutritionTiers"
    >
  >,
): Promise<MemberContentConfig> {
  const current = await getMemberContent();
  const next: MemberContentConfig = {
    ...current,
    updatedAt: new Date().toISOString(),
  };

  if (patch.weeklyVideoUrl !== undefined) {
    const url = patch.weeklyVideoUrl?.trim() || null;
    if (url && !isYoutubeUrl(url)) {
      throw new Error("Weekly video must be a valid YouTube URL.");
    }
    next.weeklyVideoUrl = url;
  }

  if (patch.weeklyVideoTitle !== undefined) {
    next.weeklyVideoTitle = patch.weeklyVideoTitle.trim() || emptyConfig().weeklyVideoTitle;
  }

  if (patch.dinnerVideoUrl !== undefined) {
    const url = patch.dinnerVideoUrl?.trim() || null;
    if (url && !isYoutubeUrl(url)) {
      throw new Error("Dinner video must be a valid YouTube URL.");
    }
    next.dinnerVideoUrl = url;
  }

  if (patch.dinnerVideoTitle !== undefined) {
    next.dinnerVideoTitle = patch.dinnerVideoTitle.trim() || emptyConfig().dinnerVideoTitle;
  }

  if (patch.dailyInspirationClips !== undefined) {
    next.dailyInspirationClips = normalizeClips(patch.dailyInspirationClips);
  }

  if (patch.nutritionIntro !== undefined) {
    next.nutritionIntro = patch.nutritionIntro.trim();
  }

  if (patch.nutritionTiers !== undefined) {
    next.nutritionTiers = normalizeTiers(patch.nutritionTiers);
  }

  const { blobSaved } = await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: next,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
  });
  requireBlobPersisted(blobSaved, "Member videos");

  return next;
}

/** Prefer clip matching weekday (0–6); else first general (null weekday); else first clip. */
export function pickDailyInspirationClip(
  clips: DailyInspirationClip[],
  weekday: number = new Date().getDay(),
): DailyInspirationClip | null {
  if (!clips.length) return null;
  const day = clips.find((c) => c.weekday === weekday);
  if (day) return day;
  const any = clips.find((c) => c.weekday === null);
  return any || clips[0] || null;
}