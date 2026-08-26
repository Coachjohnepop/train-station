/**
 * Guest landing return-mode. Cookie is a UX hint only (not durable membership).
 * Set when a visitor leaves / without boarding, or opens the hamburger and
 * closes it without a ticket/tour/sign-in tap.
 */

export const LANDING_RETURN_COOKIE = "ts_landing_return";
export const LANDING_RETURN_EVENT = "ts-landing-return-mode";
export const JOIN_TICKETS_HREF = "/join#tickets";
/** Start membership → ticket picker. Trial is a Coach Class checkout choice, not a landing CTA. */
export const JOIN_WEEK_HREF = JOIN_TICKETS_HREF;
export const JOIN_WEEK_HOOK_KEY = "ts_join_week_hook";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

/** Same-page latch so pagehide after a ticket tap does not re-arm return mode. */
let convertedThisPage = false;

export function isLandingReturnCookie(value: string | undefined | null): boolean {
  return value === "1";
}

export function readBrowserCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setLandingReturnCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${LANDING_RETURN_COOKIE}=1; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}

export function clearLandingReturnCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${LANDING_RETURN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function markLandingConverted() {
  convertedThisPage = true;
  clearLandingReturnCookie();
}

/** First-click hook: confetti from the Join button, then signup plays the second burst. */
export function fireLandingJoinHook(originEl?: HTMLElement | null) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(JOIN_WEEK_HOOK_KEY, "1");
  } catch {
    /* ignore */
  }
  void import("@/lib/workout-confetti").then(({ buzzScoreCelebrate, confettiOriginFromElement, fireWorkoutConfetti }) => {
    buzzScoreCelebrate("standard");
    fireWorkoutConfetti(originEl ? confettiOriginFromElement(originEl) : undefined, 1800);
  });
}

export function markLandingReturnPending() {
  setLandingReturnCookie();
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LANDING_RETURN_EVENT));
}

export function trackLandingCustom(action: string, extra?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const sessionKey = readBrowserCookie("ts_analytics_sid") || `land${Date.now().toString(36)}`;
  const anonymousId = readBrowserCookie("ts_analytics_aid") || undefined;
  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session: {
        sessionKey,
        anonymousId,
        landingPath: window.location.pathname,
        deviceType: window.innerWidth < 768 ? "mobile" : "desktop",
        userAgent: navigator.userAgent.slice(0, 500),
      },
      events: [
        {
          eventType: "custom",
          pagePath: window.location.pathname,
          pageSection: "landing",
          clickAction: action,
          properties: extra ?? {},
        },
      ],
    }),
    keepalive: true,
  }).catch(() => {
    /* best-effort */
  });
}

/** Call on public `/` so the next visit is return-mode if they never boarded. */
export function armLandingReturnOnLeave() {
  if (typeof window === "undefined") return () => {};

  const onLeave = () => {
    if (convertedThisPage) return;
    setLandingReturnCookie();
  };

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
