import "server-only";

import { createHmac, randomBytes } from "crypto";
import { appBaseUrl } from "@/lib/oauth/config";
import { zoomClientId, zoomClientSecret } from "@/lib/zoom-env";

export const ZOOM_OAUTH_STATE_COOKIE = "ts_zoom_oauth_state";

export const ZOOM_FREE_MAX_DURATION_MIN = 40;

/**
 * Scopes for coach OAuth — user:read:token required for Meeting SDK ZAK embed.
 * Override with ZOOM_OAUTH_SCOPES env (space-separated).
 * Set ZOOM_OAUTH_SCOPES=app to omit the scope param and use Marketplace app defaults
 * (avoids authorize errors when requested scopes aren't on the app).
 */
export const ZOOM_OAUTH_SCOPES_DEFAULT =
  "user:read:user meeting:write:meeting user:read:token";

export function zoomOAuthScopes(): string | null {
  const raw = process.env.ZOOM_OAUTH_SCOPES?.trim();
  if (raw === "app" || raw === "default" || raw === "omit") return null;
  if (raw) return raw;
  return ZOOM_OAUTH_SCOPES_DEFAULT;
}

/** @deprecated use zoomOAuthScopes() */
export const ZOOM_OAUTH_SCOPES = ZOOM_OAUTH_SCOPES_DEFAULT;

const ALLOWED_OAUTH_HOSTS = new Set([
  "www.thetrainstation.co",
  "thetrainstation.co",
  "localhost:3000",
  "localhost:3001",
  "127.0.0.1:3000",
]);

export type ZoomOAuthStatePayload = {
  coachEmail: string;
  nonce: string;
  sig: string;
  /** Must match authorize + token exchange */
  redirectUri?: string;
};

/**
 * Prefer the host the coach is actually on (www vs apex) so redirect_uri matches
 * the browser session and Zoom Marketplace allowlist.
 */
export function resolveZoomOAuthOrigin(request?: Request | null): string {
  if (request) {
    const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = xfHost || request.headers.get("host")?.trim();
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      (host?.includes("localhost") || host?.startsWith("127.") ? "http" : "https");
    if (host) {
      const normalized = host.toLowerCase().replace(/:\d+$/, (m) => m);
      // host may include port
      const hostKey = host.toLowerCase();
      if (ALLOWED_OAUTH_HOSTS.has(hostKey) || ALLOWED_OAUTH_HOSTS.has(normalized)) {
        return `${proto}://${host}`.replace(/\/$/, "");
      }
      // Allow Vercel preview hosts for debugging
      if (hostKey.endsWith(".vercel.app")) {
        return `${proto}://${host}`.replace(/\/$/, "");
      }
    }
  }
  return appBaseUrl();
}

export function zoomOAuthCallbackUrl(request?: Request | null): string {
  return `${resolveZoomOAuthOrigin(request)}/api/admin/zoom/callback`;
}

export function zoomOAuthAppConfigured(): boolean {
  return Boolean(zoomClientId() && zoomClientSecret());
}

export function createZoomOAuthState(
  coachEmail: string,
  redirectUri?: string,
): string {
  const nonce = randomBytes(16).toString("hex");
  const secret = process.env.SESSION_SECRET?.trim() || zoomClientSecret() || "zoom-oauth";
  const sig = createHmac("sha256", secret)
    .update(`${coachEmail}:${nonce}:${redirectUri || ""}`)
    .digest("hex")
    .slice(0, 16);
  const payload: ZoomOAuthStatePayload = {
    coachEmail,
    nonce,
    sig,
    ...(redirectUri ? { redirectUri } : {}),
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function parseZoomOAuthState(state: string): ZoomOAuthStatePayload | null {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as ZoomOAuthStatePayload;
  } catch {
    return null;
  }
}

export function verifyZoomOAuthState(state: string, coachEmail: string): boolean {
  try {
    const parsed = parseZoomOAuthState(state);
    if (!parsed?.coachEmail || parsed.coachEmail !== coachEmail) return false;
    const secret = process.env.SESSION_SECRET?.trim() || zoomClientSecret() || "zoom-oauth";
    const expected = createHmac("sha256", secret)
      .update(`${parsed.coachEmail}:${parsed.nonce}:${parsed.redirectUri || ""}`)
      .digest("hex")
      .slice(0, 16);
    // Also accept legacy states that didn't include redirectUri in the sig payload
    if (parsed.sig === expected) return true;
    const legacy = createHmac("sha256", secret)
      .update(`${parsed.coachEmail}:${parsed.nonce}`)
      .digest("hex")
      .slice(0, 16);
    return parsed.sig === legacy;
  } catch {
    return false;
  }
}

export function buildZoomAuthorizeUrl(state: string, redirectUri?: string): string {
  const clientId = zoomClientId();
  if (!clientId) throw new Error("ZOOM_CLIENT_ID is not set.");
  const redirect = redirectUri || zoomOAuthCallbackUrl();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirect,
    state,
  });
  const scopes = zoomOAuthScopes();
  if (scopes) params.set("scope", scopes);
  return `https://zoom.us/oauth/authorize?${params}`;
}

export function capZoomDurationMin(durationMin: number): number {
  return Math.min(Math.max(1, durationMin), ZOOM_FREE_MAX_DURATION_MIN);
}
