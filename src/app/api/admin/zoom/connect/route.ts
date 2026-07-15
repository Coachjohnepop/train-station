import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  buildZoomAuthorizeUrl,
  createZoomOAuthState,
  ZOOM_OAUTH_STATE_COOKIE,
  zoomOAuthAppConfigured,
} from "@/lib/zoom-oauth-flow";
import { rememberZoomOAuthState } from "@/lib/zoom-oauth-pending";
import { clearZoomOAuthRecord } from "@/lib/zoom-oauth-store";

export const dynamic = "force-dynamic";

/**
 * Start Zoom OAuth for the signed-in coach.
 * ?switch=1 clears any existing linked Zoom first (use when changing accounts).
 */
export async function GET(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  if (!zoomOAuthAppConfigured()) {
    return NextResponse.json(
      { error: "Set ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET in Vercel first." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const switching = url.searchParams.get("switch") === "1";
  if (switching) {
    await clearZoomOAuthRecord(auth.session.email);
  }

  const state = createZoomOAuthState(auth.session.email);
  await rememberZoomOAuthState(state, auth.session.email);
  const res = NextResponse.redirect(buildZoomAuthorizeUrl(state));
  res.cookies.set(ZOOM_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}