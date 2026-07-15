import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import { appBaseUrl } from "@/lib/oauth/config";
import {
  verifyZoomOAuthState,
  ZOOM_OAUTH_STATE_COOKIE,
} from "@/lib/zoom-oauth-flow";
import { consumeZoomOAuthState } from "@/lib/zoom-oauth-pending";
import { exchangeZoomAuthCode, fetchZoomUserProfile } from "@/lib/zoom";
import {
  isAllowedZoomHostEmail,
  zoomRequiredHostEmail,
} from "@/lib/zoom-env";
import { saveZoomOAuthRecord } from "@/lib/zoom-oauth-store";

export const dynamic = "force-dynamic";

function redirectWithError(reason: string, detail?: string): NextResponse {
  const settingsUrl = `${appBaseUrl()}/admin/settings`;
  const params = new URLSearchParams({ zoom: "error", reason });
  if (detail) params.set("detail", detail.slice(0, 180));
  return NextResponse.redirect(`${settingsUrl}?${params.toString()}`);
}

export async function GET(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) {
    return redirectWithError("session");
  }

  const url = new URL(request.url);
  const zoomError = url.searchParams.get("error");
  const zoomDescription = url.searchParams.get("error_description") || "";
  if (zoomError) {
    const reason =
      /scope|invalid/i.test(zoomError) || /scope/i.test(zoomDescription)
        ? "scope"
        : "denied";
    return redirectWithError(reason, zoomDescription || zoomError);
  }

  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state");
  const cookieStore = await cookies();
  const cookieState = cookieStore.get(ZOOM_OAUTH_STATE_COOKIE)?.value;

  if (!code || !rawState) {
    return redirectWithError("missing_code");
  }

  const state = (() => {
    try {
      return decodeURIComponent(rawState).trim();
    } catch {
      return rawState.trim();
    }
  })();

  const stateOk =
    (state === cookieState && verifyZoomOAuthState(state, auth.session.email)) ||
    (await consumeZoomOAuthState(state, auth.session.email));

  if (!stateOk) {
    return redirectWithError("state");
  }

  try {
    const tokens = await exchangeZoomAuthCode(code);
    const profile = await fetchZoomUserProfile(tokens.accessToken);

    // Recordings + host identity must be Jeremy's Zoom, not a shared/staff login.
    if (!isAllowedZoomHostEmail(profile.email)) {
      const required = zoomRequiredHostEmail();
      const got = (profile.email || "unknown").trim() || "unknown";
      return redirectWithError(
        "wrong_host",
        `Zoom signed in as ${got} — need ${required}. Sign out of Zoom, then Connect again.`,
      );
    }

    const { saved } = await saveZoomOAuthRecord({
      zoomUserId: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      refreshToken: tokens.refreshToken,
      connectedAt: new Date().toISOString(),
      connectedByEmail: auth.session.email,
    });

    const settingsUrl = `${appBaseUrl()}/admin/settings`;
    const res = NextResponse.redirect(`${settingsUrl}?zoom=connected`);
    res.cookies.set(ZOOM_OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    if (!saved) {
      const params = new URLSearchParams({
        zoom: "connected",
        warn: "save",
      });
      return NextResponse.redirect(`${settingsUrl}?${params.toString()}`);
    }
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/scope/i.test(message)) return redirectWithError("scope", message);
    if (/redirect/i.test(message)) return redirectWithError("redirect", message);
    console.error("Zoom OAuth callback failed:", message);
    return redirectWithError("exchange", message);
  }
}