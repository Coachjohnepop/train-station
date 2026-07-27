import type { SignupPlan } from "@/lib/signup-plans";
import { MEMBERSHIP_PLANS, normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";
import type { WelcomeVideosByPlan } from "@/lib/landing-media-store";
import { youtubeEmbedUrl } from "@/lib/youtube";

/** Optional Vercel fallback if blob config is empty (full URL or bare video id). */
function envFallback(key: string): string | null {
  const raw = process.env[key]?.trim();
  return raw || null;
}

export type LandingVideoEmbedOptions = {
  autoplay?: boolean;
  /** false = audible autoplay (works on mobile right after a tap). */
  mute?: boolean;
  /** Required for YouTube iframe postMessage commands (enablejsapi). */
  origin?: string;
  /** Jump to second on load (YouTube `start=`). Also read from URL `t=` / `start=`. */
  startSeconds?: number;
};

export function landingVideoEmbedSrc(
  videoUrl: string | null | undefined,
  autoplay = true,
  options: LandingVideoEmbedOptions = {},
): string | null {
  if (!videoUrl?.trim()) return null;
  const trimmed = videoUrl.trim();
  const shouldAutoplay = autoplay || options.autoplay;
  let base = youtubeEmbedUrl(trimmed, {
    autoplay: shouldAutoplay,
    mute: options.mute ?? (shouldAutoplay ? false : undefined),
    enableJsApi: true,
    origin: options.origin,
    startSeconds: options.startSeconds,
  });
  if (!base && /^[A-Za-z0-9_-]{6,}$/.test(trimmed)) {
    base = youtubeEmbedUrl(`https://www.youtube.com/watch?v=${trimmed}`, {
      autoplay: shouldAutoplay,
      mute: options.mute ?? (shouldAutoplay ? false : undefined),
      enableJsApi: true,
      origin: options.origin,
      startSeconds: options.startSeconds,
    });
  }
  return base;
}

export function resolveLandingVideoUrl(
  storedUrl: string | null | undefined,
  envKeys: string[],
): string | null {
  if (storedUrl?.trim()) return storedUrl.trim();
  for (const key of envKeys) {
    const fromEnv = envFallback(key);
    if (fromEnv) return fromEnv;
  }
  return null;
}

export function welcomeVideoUrlFromConfig(stored: string | null | undefined) {
  return resolveLandingVideoUrl(stored, [
    "NEXT_PUBLIC_WELCOME_VIDEO_URL",
    "NEXT_PUBLIC_WELCOME_VIDEO_YT",
  ]);
}

export function welcomeVideoUrlForPlan(
  plan: SignupPlan | string | null | undefined,
  storedDefault: string | null | undefined,
  byPlan: WelcomeVideosByPlan = {},
): string | null {
  const normalized = normalizeSignupPlan(plan);
  if ((MEMBERSHIP_PLANS as readonly string[]).includes(normalized)) {
    const planUrl = byPlan[normalized as keyof WelcomeVideosByPlan];
    if (planUrl?.trim()) return planUrl.trim();
  }
  return welcomeVideoUrlFromConfig(storedDefault);
}

export const WELCOME_VIDEO_PLAN_OPTIONS = MEMBERSHIP_PLANS.map((plan) => ({
  plan,
  label: signupPlanLabel(plan),
}));

/**
 * Free / Explorer ticket gag: default Rick Astley from the chorus, ~10s, then fade to
 * Jeremy’s free-tier intro (Admin → Videos free-ticket video — not this URL).
 * Admins can override URL / start / duration under Admin → Videos.
 */
export const FREE_TICKET_RICKROLL_URL =
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43s";

/** Chorus start second for Never Gonna Give You Up. */
export const FREE_TICKET_RICKROLL_CHORUS_START_SEC = 43;

/** How long the gag plays before crossfading to Jeremy. */
export const FREE_TICKET_RICKROLL_DURATION_MS = 10_000;

/** Crossfade length (must match FreeTicketModal CSS transition). */
export const FREE_TICKET_RICKROLL_FADE_MS = 1_500;

export type FreeTicketGagConfig = {
  enabled: boolean;
  videoUrl: string;
  startSec: number;
  durationMs: number;
};

/** Resolve gag settings from admin store (with hard-coded defaults). */
export function resolveFreeTicketGag(input?: {
  gagEnabled?: boolean | null;
  gagVideoUrl?: string | null;
  gagStartSec?: number | null;
  gagDurationSec?: number | null;
} | null): FreeTicketGagConfig {
  const enabled = input?.gagEnabled !== false;
  const videoUrl =
    input?.gagVideoUrl?.trim() || FREE_TICKET_RICKROLL_URL;
  const startSec =
    typeof input?.gagStartSec === "number" && Number.isFinite(input.gagStartSec)
      ? Math.max(0, Math.min(3600, Math.round(input.gagStartSec)))
      : FREE_TICKET_RICKROLL_CHORUS_START_SEC;
  const durationSec =
    typeof input?.gagDurationSec === "number" && Number.isFinite(input.gagDurationSec)
      ? Math.max(3, Math.min(60, Math.round(input.gagDurationSec)))
      : FREE_TICKET_RICKROLL_DURATION_MS / 1000;
  return {
    enabled,
    videoUrl,
    startSec,
    durationMs: durationSec * 1000,
  };
}

export function isRickrollVideoUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return /dQw4w9WgXcQ/i.test(url) || /rick.?roll/i.test(url);
}

/**
 * Jeremy free-tier intro after the gag.
 * Does **not** fall back to Rickroll — the gag is always hard-coded in FreeTicketModal.
 * Legacy admin values that stored the rickroll URL are treated as empty.
 */
export function freeChastiseVideoUrlFromConfig(stored: string | null | undefined) {
  const resolved = resolveLandingVideoUrl(stored, [
    "NEXT_PUBLIC_FREE_CHASTISE_VIDEO_URL",
    "NEXT_PUBLIC_FREE_CHASTISE_VIDEO_YT",
  ]);
  if (!resolved || isRickrollVideoUrl(resolved)) return null;
  return resolved;
}