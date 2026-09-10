import { introTrimWindow, type IntroTrim } from "@/lib/intro-trim";
import {
  clampMixVolume,
  isAllowedHeroAudioUrl,
  THEME_SONG_NARRATION_DUCK_DEFAULT,
} from "@/lib/landing-mix-audio";

export const HOW_IT_WORKS_STEP_IDS = [
  "workout",
  "ticket",
  "program",
  "gear",
  "book",
] as const;

export type HowItWorksStepId = (typeof HOW_IT_WORKS_STEP_IDS)[number];

export type HowItWorksVoice = IntroTrim & {
  audioUrl: string | null;
};

export type HowItWorksStep = {
  id: HowItWorksStepId;
  title: string;
  coachLine: string;
  voice: HowItWorksVoice;
};

export type HowItWorksConfig = {
  steps: HowItWorksStep[];
  /** Theme Song volume multiplier (0–1) while a How it Works voice-over plays. */
  themeSongDuck: number;
};

export const HOW_IT_WORKS_DEFAULT_STEPS: HowItWorksStep[] = [
  {
    id: "workout",
    title: "Today",
    coachLine: "This is Today. Log the weight, check the sets — done.",
    voice: { audioUrl: null, startSec: 0, endSec: null },
  },
  {
    id: "ticket",
    title: "Tickets",
    coachLine: "How you get in. Like this — pick a ticket class. Business shown.",
    voice: { audioUrl: null, startSec: 0, endSec: null },
  },
  {
    id: "program",
    title: "Programs",
    coachLine: "Then pick a program. Like this — Adult is the home base.",
    voice: { audioUrl: null, startSec: 0, endSec: null },
  },
  {
    id: "gear",
    title: "Your gear",
    coachLine: "Tap what you have at home. Change it anytime in Settings.",
    voice: { audioUrl: null, startSec: 0, endSec: null },
  },
  {
    id: "book",
    title: "Book Jeremy",
    coachLine: "Want a real voice? Book 15 minutes with Coach Jeremy.",
    voice: { audioUrl: null, startSec: 0, endSec: null },
  },
];

const TITLE_MAX = 48;
const LINE_MAX = 180;

function cleanText(raw: unknown, fallback: string, max: number): string {
  const text = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!text) return fallback;
  return text.length > max ? `${text.slice(0, max)}` : text;
}

function cleanVoice(raw: unknown): HowItWorksVoice {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const url = typeof data.audioUrl === "string" ? data.audioUrl.trim() : "";
  const audioUrl = url && isAllowedHeroAudioUrl(url) ? url : null;
  const startSec = Math.max(0, Number(data.startSec) || 0);
  const endRaw = data.endSec;
  const endSec =
    endRaw == null || endRaw === "" || !Number.isFinite(Number(endRaw))
      ? null
      : Math.max(startSec + 0.5, Number(endRaw));
  return { audioUrl, startSec, endSec };
}

export function defaultHowItWorks(): HowItWorksConfig {
  return {
    steps: HOW_IT_WORKS_DEFAULT_STEPS.map((step) => ({ ...step, voice: { ...step.voice } })),
    themeSongDuck: THEME_SONG_NARRATION_DUCK_DEFAULT,
  };
}

export function normalizeHowItWorks(raw: unknown): HowItWorksConfig {
  const data = raw && typeof raw === "object" ? (raw as { steps?: unknown; themeSongDuck?: unknown }) : {};
  const incoming = Array.isArray(data.steps) ? data.steps : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of incoming) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    if (typeof rec.id === "string") byId.set(rec.id, rec);
  }
  return {
    themeSongDuck: clampMixVolume(data.themeSongDuck, THEME_SONG_NARRATION_DUCK_DEFAULT),
    steps: HOW_IT_WORKS_DEFAULT_STEPS.map((fallback) => {
      const hit = byId.get(fallback.id);
      if (!hit) return { ...fallback, voice: { ...fallback.voice } };
      return {
        id: fallback.id,
        title: cleanText(hit.title, fallback.title, TITLE_MAX),
        coachLine: cleanText(hit.coachLine, fallback.coachLine, LINE_MAX),
        voice: cleanVoice(hit.voice),
      };
    }),
  };
}

export function howItWorksStepById(
  config: HowItWorksConfig | null | undefined,
  id: HowItWorksStepId,
): HowItWorksStep {
  return config?.steps.find((s) => s.id === id) ?? HOW_IT_WORKS_DEFAULT_STEPS.find((s) => s.id === id)!;
}

export function howItWorksVoiceWindow(
  voice: HowItWorksVoice,
  durationSec?: number | null,
): { start: number; end: number | null } {
  return introTrimWindow({ startSec: voice.startSec, endSec: voice.endSec }, durationSec);
}

export function howItWorksHasVoice(step: HowItWorksStep | null | undefined): boolean {
  return Boolean(step?.voice.audioUrl);
}
