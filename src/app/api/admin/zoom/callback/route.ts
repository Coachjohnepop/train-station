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
import { saveZoomOAuthRecord } from "@/lib/zoom-oauth-store";

export const dynamic = "force-dynamic";

function redirectWithError(reason: string): NextResponse {
  const settingsUrl = `${appBaseUrl()}/admin/settings`;
  const params = new URLSearchParams({ zoom: "error", reason });
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
    return redirectWithError(reason);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const cookieState = cookieStore.get(ZOOM_OAUTH_STATE_COOKIE)?.value;

  if (!code || !state) {
    return redirectWithError("missing_code");
  }

  const stateOk =
    (state === cookieState && verifyZoomOAuthState(state, auth.session.email)) ||
    (await consumeZoomOAuthState(state, auth.session.email));

  if (!stateOk) {
    return redirectWithError("state");
  }

  try {
    const tokens = await exchangeZoomAuthCode(code);
    const profile = await fetchZoomUserProfile(tokens.accessToken);
    const { blobSaved } = await saveZoomOAuthRecord({
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
    if (!blobSaved) {
      const params = new URLSearchParams({
        zoom: "connected",
        warn: "save",
      });
      return NextResponse.redirect(`${settingsUrl}?${params.toString()}`);
    }
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/scope/i.test(message)) return redirectWithError("scope");
    if (/redirect/i.test(message)) return redirectWithError("redirect");
    console.error("Zoom OAuth callback failed:", message);
    return redirectWithError("exchange");
  }
}