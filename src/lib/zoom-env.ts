import "server-only";

/** Read Zoom env at request time — avoids Next build inlining stale credentials. */
export function zoomClientId(): string {
  return process.env["ZOOM_CLIENT_ID"]?.trim() || "";
}

export function zoomClientSecret(): string {
  return process.env["ZOOM_CLIENT_SECRET"]?.trim() || "";
}

export function zoomAccountId(): string {
  return process.env["ZOOM_ACCOUNT_ID"]?.trim() || "";
}

/**
 * Zoom user that must host live class (recordings land here).
 * Override with ZOOM_HOST_EMAIL in Vercel if the coach uses a different Zoom login.
 * Optional ZOOM_HOST_EMAILS=comma,list for multiple allowed hosts.
 */
export function zoomRequiredHostEmail(): string {
  return (
    process.env["ZOOM_HOST_EMAIL"]?.trim().toLowerCase() ||
    "jeremy@thetrainstation.co"
  );
}

export function zoomAllowedHostEmails(): string[] {
  const primary = zoomRequiredHostEmail();
  const extra = (process.env["ZOOM_HOST_EMAILS"] || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([primary, ...extra].filter(Boolean))];
}

export function isAllowedZoomHostEmail(email: string | null | undefined): boolean {
  const got = (email || "").trim().toLowerCase();
  if (!got) return false;
  const allowed = zoomAllowedHostEmails();
  if (allowed.length === 0) return true;
  if (allowed.includes(got)) return true;
  // Allow any @thetrainstation.co only when explicitly enabled
  if (process.env["ZOOM_ALLOW_TRAIN_STATION_DOMAIN"] === "1") {
    return got.endsWith("@thetrainstation.co");
  }
  return false;
}

/**
 * Multi-coach host rule: Zoom profile email may match the coach's Train Station
 * login, or appear on the global ZOOM_HOST_EMAIL(S) allowlist / domain flag.
 */
export function isAllowedZoomHostForCoach(
  zoomEmail: string | null | undefined,
  coachEmail: string | null | undefined,
): boolean {
  const z = (zoomEmail || "").trim().toLowerCase();
  const c = (coachEmail || "").trim().toLowerCase();
  if (z && c && z === c) return true;
  return isAllowedZoomHostEmail(z);
}

/** Primary expected host for UI: coach's own login when multi-coach. */
export function expectedZoomHostForCoach(coachEmail: string | null | undefined): string {
  const c = (coachEmail || "").trim().toLowerCase();
  if (c) return c;
  return zoomRequiredHostEmail();
}