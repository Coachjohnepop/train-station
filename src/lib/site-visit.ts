/**
 * First time on the site vs been here before.
 * Cookie is set when the first visit ends (leave) or after they finish setup.
 * Absence = first visit. Not the same as unfinished onboarding.
 */

export const SITE_SEEN_COOKIE = "ts_site_seen";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

export function isSiteSeenCookie(value: string | undefined | null): boolean {
  return value === "1";
}

/** True only if this browser has never been marked as having visited. */
export function isFirstTimeOnSite(siteSeenCookie: string | undefined | null): boolean {
  return !isSiteSeenCookie(siteSeenCookie);
}

/** Setup finished this visit / last day — still first-time, not a returning member. */
export function finishedSetupThisVisit(completedAt: string | null | undefined, withinHours = 48): boolean {
  if (!completedAt) return false;
  const at = Date.parse(completedAt);
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < withinHours * 60 * 60 * 1000;
}

export function setSiteSeenCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SITE_SEEN_COOKIE}=1; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}

/** First visit lasts the whole session. Mark seen when they leave. */
export function armSiteSeenOnLeave() {
  if (typeof window === "undefined") return () => {};

  const onLeave = () => setSiteSeenCookie();
  const onVisibility = () => {
    if (document.visibilityState === "hidden") onLeave();
  };

  window.addEventListener("pagehide", onLeave);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("pagehide", onLeave);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
