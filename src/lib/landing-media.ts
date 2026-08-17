import type { SignupPlan } from "@/lib/signup-plans";
import { MEMBERSHIP_PLANS, normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";
import type { WelcomeVideosByPlan } from "@/lib/landing-media-store";
import { isDirectVideoUrl } from "@/lib/site-video";
import { isYoutubeUrl, youtubeEmbedUrl } from "@/lib/youtube";

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

/** Overall Jeremy welcome — site file, not YouTube. */
export const JEREMY_WELCOME_VIDEO_SRC = "/videos/jeremy-welcome.mp4";
/** Free Explorer intro after the gag — site file, not YouTube. */
export const JEREMY_FREE_INTRO_VIDEO_SRC = "/videos/jeremy-free-intro.mp4?v=20260816e";

const LEGACY_BLOB_INTRO_RE =
  /8454de13-15b8-41f3-a476-b6b613c83983|28a8e280-bcf3-4e43-938d-2060a53527c4/i;

function resolveCoachIntroFile(
  stored: string | null | undefined,
  fallback: string,
): string {
  const trimmed = stored?.trim();
  if (
    trimmed &&
    !isYoutubeUrl(trimmed) &&
    !isRickrollVideoUrl(trimmed) &&
    !LEGACY_BLOB_INTRO_RE.test(trimmed) &&
    isDirectVideoUrl(trimmed)
  ) {
    return trimmed;
  }
  return fallback;
}

export function welcomeVideoUrlFromConfig(stored: string | null | undefined) {
  const resolved = resolveLandingVideoUrl(stored, [
    "NEXT_PUBLIC_WELCOME_VIDEO_URL",
    "NEXT_PUBLIC_WELCOME_VIDEO_YT",
  ]);
  return resolveCoachIntroFile(resolved, JEREMY_WELCOME_VIDEO_SRC);
}

function fileOnlyIntro(stored: string | null | undefined, envKeys: string[]): string | null {
  const raw = resolveLandingVideoUrl(stored, envKeys);
  if (!raw || isYoutubeUrl(raw) || isRickrollVideoUrl(raw) || !isDirectVideoUrl(raw)) {
    return null;
  }
  return raw;
}

/** First-visit Gear tab intro (Jeremy home-gym buying guide). File only — no YouTube. */
export function equipmentIntroVideoUrlFromConfig(stored: string | null | undefined) {
  return fileOnlyIntro(stored, ["NEXT_PUBLIC_EQUIPMENT_INTRO_VIDEO_URL"]);
}

/** First-visit Measurements tab — how to take body measurements. File only — no YouTube. */
export function measurementsIntroVideoUrlFromConfig(stored: string | null | undefined) {
  return fileOnlyIntro(stored, ["NEXT_PUBLIC_MEASUREMENTS_INTRO_VIDEO_URL"]);
}

export function welcomeVideoUrlForPlan(
  plan: SignupPlan | string | null | undefined,
  storedDefault: string | null | undefined,
  byPlan: WelcomeVideosByPlan = {},
  /** Unified Free Explorer clip (same as free-ticket intro after gag). */
  freeExplorerUrl: string | null | undefined = null,
): string | null {
  const normalized = normalizeSignupPlan(plan);
  if (normalized === "explorer") {
    const free = freeExplorerUrl?.trim() || byPlan.explorer?.trim() || null;
    return resolveCoachIntroFile(free, JEREMY_FREE_INTRO_VIDEO_SRC);
  }
  if ((MEMBERSHIP_PLANS as readonly string[]).includes(normalized)) {
    const planUrl = byPlan[normalized as keyof WelcomeVideosByPlan];
    return resolveCoachIntroFile(planUrl, welcomeVideoUrlFromConfig(storedDefault));
  }
  return welcomeVideoUrlFromConfig(storedDefault);
}

export const WELCOME_VIDEO_PLAN_OPTIONS = MEMBERSHIP_PLANS.map((plan) => ({
  plan,
  label: signupPlanLabel(plan),
}));

/**
 * Free / Explorer ticket gag — **product defaults are fixed** (not admin-overridable):
 * in-app 5s chorus file, then Jeremy free-tier intro.
 *
 * Who gets the gag:
 * - Anonymous / not signed in on landing Free → always on
 * - Signed-in members (Explorer re-open Free, etc.) → skip gag, straight to Jeremy
 *
 * Admin → Videos: one Free Explorer intro (after gag + Free onboard). Gag is
 * product-fixed; no admin gag upload.
 */
/** Local chorus clip (starts at the hook — no YouTube seek). */
export const FREE_TICKET_GAG_SRC = "/videos/free-ticket-chorus.mp4";
export const FREE_TICKET_GAG_POSTER = "/videos/free-ticket-chorus.jpg?v=20260816";
export const FREE_TICKET_GAG_AUDIO_SRC = "/audio/free-ticket-chorus.mp3";
/** Chorus + Jeremy intro in one file — no swap, no YouTube. */
export const FREE_TICKET_FULL_SRC = "/videos/free-ticket-full.mp4?v=20260816e";

/** Prefer the last rebuild (Blob) so a new Jeremy intro is live without a deploy. */
export function freeTicketFullSrcFromConfig(url: string | null | undefined): string {
  const trimmed = url?.trim();
  if (trimmed && !isYoutubeUrl(trimmed)) return trimmed;
  return FREE_TICKET_FULL_SRC;
}

/** Legacy watch URL — never played. YouTube is too slow for Free tap. */
export const FREE_TICKET_RICKROLL_URL =
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

/** Legacy chorus start. Local file is already trimmed. */
export const FREE_TICKET_RICKROLL_CHORUS_START_SEC = 43;

/** Gag is the in-app file only. YouTube embeds are not used. */
export const FREE_TICKET_GAG_MODE = "file" as const;

export function isFreeTicketGagYoutube(): boolean {
  return false;
}

/** How long the gag plays before cutting over to Jeremy. */
export const FREE_TICKET_RICKROLL_DURATION_MS = 5_000;

/**
 * Rickroll → Jeremy crossfade.
 * Audio ramps volume 100 → 0 over this window (must be 2s for product).
 * Visual opacity uses the same duration.
 */
export const FREE_TICKET_RICKROLL_FADE_MS = 2_000;

export type FreeTicketGagConfig = {
  enabled: boolean;
  videoUrl: string;
  startSec: number;
  durationMs: number;
};

/** Product gag for Free ticket UI (ignores admin custom gag URL / duration). */
export function productFreeTicketGag(opts: {
  /** Signed-in members skip the joke, unless force is set (re-onboard / QA). */
  signedIn: boolean;
  force?: boolean;
}): FreeTicketGagConfig {
  return {
    enabled: Boolean(opts.force) || !opts.signedIn,
    videoUrl: FREE_TICKET_GAG_SRC,
    startSec: 0,
    durationMs: FREE_TICKET_RICKROLL_DURATION_MS,
  };
}

/**
 * Resolve gag for APIs / legacy callers.
 * Product path always uses fixed 5s Rickroll (admin URL/start/duration ignored).
 * `gagEnabled: false` is still a kill switch if ever needed in store.
 */
export function resolveFreeTicketGag(input?: {
  gagEnabled?: boolean | null;
  gagVideoUrl?: string | null;
  gagStartSec?: number | null;
  gagDurationSec?: number | null;
} | null): FreeTicketGagConfig {
  const killSwitch = input?.gagEnabled === false;
  return {
    enabled: !killSwitch,
    videoUrl: FREE_TICKET_GAG_SRC,
    startSec: 0,
    durationMs: FREE_TICKET_RICKROLL_DURATION_MS,
  };
}

export function isRickrollVideoUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return (
    /dQw4w9WgXcQ/i.test(url) ||
    /rick.?roll/i.test(url) ||
    /free-ticket-chorus/i.test(url)
  );
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
  return resolveCoachIntroFile(resolved, JEREMY_FREE_INTRO_VIDEO_SRC);
}