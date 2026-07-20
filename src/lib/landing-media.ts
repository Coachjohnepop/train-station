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
  });
  if (!base && /^[A-Za-z0-9_-]{6,}$/.test(trimmed)) {
    base = youtubeEmbedUrl(`https://www.youtube.com/watch?v=${trimmed}`, {
      autoplay: shouldAutoplay,
      mute: options.mute ?? (shouldAutoplay ? false : undefined),
      enableJsApi: true,
      origin: options.origin,
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

/** No joke/default YouTube — only play when coach or env configures a real URL. */
export function freeChastiseVideoUrlFromConfig(stored: string | null | undefined) {
  return resolveLandingVideoUrl(stored, [
    "NEXT_PUBLIC_FREE_CHASTISE_VIDEO_URL",
    "NEXT_PUBLIC_FREE_CHASTISE_VIDEO_YT",
  ]);
}