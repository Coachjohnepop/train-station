import "server-only";

import { createHmac, randomBytes } from "crypto";
import { appBaseUrl } from "@/lib/oauth/config";
import { zoomClientId, zoomClientSecret } from "@/lib/zoom-env";

export const ZOOM_OAUTH_STATE_COOKIE = "ts_zoom_oauth_state";

export const ZOOM_FREE_MAX_DURATION_MIN = 40;

/** Scopes for coach OAuth — user:read:token required for Meeting SDK ZAK embed. */
export const ZOOM_OAUTH_SCOPES =
  "user:read:user meeting:write:meeting user:read:token";

export function zoomOAuthCallbackUrl(): string {
  return `${appBaseUrl()}/api/admin/zoom/callback`;
}

export function zoomOAuthAppConfigured(): boolean {
  return Boolean(zoomClientId() && zoomClientSecret());
}

export function createZoomOAuthState(coachEmail: string): string {
  const nonce = randomBytes(16).toString("hex");
  const secret = process.env.SESSION_SECRET?.trim() || zoomClientSecret() || "zoom-oauth";
  const sig = createHmac("sha256", secret).update(`${coachEmail}:${nonce}`).digest("hex").slice(0, 16);
  return Buffer.from(JSON.stringify({ coachEmail, nonce, sig })).toString("base64url");
}

export function verifyZoomOAuthState(state: string, coachEmail: string): boolean {
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      coachEmail?: string;
      nonce?: string;
      sig?: string;
    };
    if (!parsed.coachEmail || parsed.coachEmail !== coachEmail) return false;
    const secret = process.env.SESSION_SECRET?.trim() || zoomClientSecret() || "zoom-oauth";
    const expected = createHmac("sha256", secret)
      .update(`${parsed.coachEmail}:${parsed.nonce}`)
      .digest("hex")
      .slice(0, 16);
    return parsed.sig === expected;
  } catch {
    return false;
  }
}

export function buildZoomAuthorizeUrl(state: string): string {
  const clientId = zoomClientId();
  if (!clientId) throw new Error("ZOOM_CLIENT_ID is not set.");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: zoomOAuthCallbackUrl(),
    state,
    scope: ZOOM_OAUTH_SCOPES,
  });
  return `https://zoom.us/oauth/authorize?${params}`;
}

export function capZoomDurationMin(durationMin: number): number {
  return Math.min(Math.max(1, durationMin), ZOOM_FREE_MAX_DURATION_MIN);
}