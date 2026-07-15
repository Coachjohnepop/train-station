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
 */
export function zoomRequiredHostEmail(): string {
  return (
    process.env["ZOOM_HOST_EMAIL"]?.trim().toLowerCase() ||
    "jeremy@thetrainstation.co"
  );
}

export function isAllowedZoomHostEmail(email: string | null | undefined): boolean {
  const required = zoomRequiredHostEmail();
  if (!required) return true;
  return (email || "").trim().toLowerCase() === required;
}