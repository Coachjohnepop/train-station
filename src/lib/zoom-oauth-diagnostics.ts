import "server-only";

import { isDemoMode } from "@/lib/demo-enrollments";
import {
  zoomOAuthCallbackUrl,
  zoomOAuthScopes,
  ZOOM_OAUTH_SCOPES_DEFAULT,
} from "@/lib/zoom-oauth-flow";
import { getZoomOAuthRecord } from "@/lib/zoom-oauth-store";
import { probeZoomOAuthDb } from "@/lib/zoom-oauth-store-db";
import { zoomClientId, zoomClientSecret } from "@/lib/zoom-env";

export type ZoomOAuthDiagnostics = {
  clientIdPresent: boolean;
  secretPresent: boolean;
  clientIdPrefix: string | null;
  redirectUri: string;
  scopes: string;
  scopesMode: "explicit" | "app_defaults";
  tokenProbe: "invalid_client" | "invalid_grant" | "other" | "skipped";
  tokenProbeDetail: string | null;
  dbOk: boolean;
  dbDetail: string | null;
  oauthRecord: "connected" | "cleared" | "missing";
  oauthEmail: string | null;
  coachEmail: string | null;
};

export async function getZoomOAuthDiagnostics(
  coachEmail?: string | null,
): Promise<ZoomOAuthDiagnostics> {
  const clientId = zoomClientId();
  const secret = zoomClientSecret();
  const redirectUri = zoomOAuthCallbackUrl();
  const scopes = zoomOAuthScopes();

  let tokenProbe: ZoomOAuthDiagnostics["tokenProbe"] = "skipped";
  let tokenProbeDetail: string | null = null;

  if (clientId && secret) {
    const basic = Buffer.from(`${clientId}:${secret}`).toString("base64");
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: "diagnostic-probe-code",
      redirect_uri: redirectUri,
    });
    try {
      const res = await fetch("https://zoom.us/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        reason?: string;
      };
      const err = data.error || "";
      if (err === "invalid_client") tokenProbe = "invalid_client";
      else if (err === "invalid_grant") tokenProbe = "invalid_grant";
      else tokenProbe = "other";
      tokenProbeDetail = data.reason || err || `http_${res.status}`;
    } catch (e) {
      tokenProbe = "other";
      tokenProbeDetail = e instanceof Error ? e.message : String(e);
    }
  }

  const dbProbe = isDemoMode()
    ? { ok: true, message: "demo_mode_local_file" }
    : await probeZoomOAuthDb();
  const record = coachEmail
    ? await getZoomOAuthRecord({ coachEmail, preferFresh: true })
    : null;

  return {
    clientIdPresent: Boolean(clientId),
    secretPresent: Boolean(secret),
    clientIdPrefix: clientId ? `${clientId.slice(0, 4)}…${clientId.slice(-4)}` : null,
    redirectUri,
    scopes: scopes || ZOOM_OAUTH_SCOPES_DEFAULT,
    scopesMode: scopes ? "explicit" : "app_defaults",
    tokenProbe,
    tokenProbeDetail,
    dbOk: dbProbe.ok,
    dbDetail: dbProbe.ok ? null : dbProbe.message,
    oauthRecord: record?.refreshToken ? "connected" : "missing",
    oauthEmail: record?.email || null,
    coachEmail: coachEmail || null,
  };
}