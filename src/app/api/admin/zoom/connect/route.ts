import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  buildZoomAuthorizeUrl,
  createZoomOAuthState,
  ZOOM_OAUTH_STATE_COOKIE,
  zoomOAuthAppConfigured,
} from "@/lib/zoom-oauth-flow";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  if (!zoomOAuthAppConfigured()) {
    return NextResponse.json(
      { error: "Set ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET in Vercel first." },
      { status: 503 },
    );
  }

  const state = createZoomOAuthState(auth.session.email);
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