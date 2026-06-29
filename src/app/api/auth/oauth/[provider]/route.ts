import { NextResponse } from "next/server";
import { oauthProviderEnabled, parseOAuthProvider } from "@/lib/oauth/config";
import { buildProviderAuthUrl } from "@/lib/oauth/provider-flow";
import { createOAuthState, oauthStateCookieOptions } from "@/lib/oauth/state";
import { OAUTH_STATE_COOKIE } from "@/lib/oauth/config";

type Params = { params: Promise<{ provider: string }> };

export async function GET(request: Request, { params }: Params) {
  const { provider: raw } = await params;
  const provider = parseOAuthProvider(raw);
  if (!provider || !oauthProviderEnabled(provider)) {
    return NextResponse.json({ error: "Social sign-in is not available." }, { status: 404 });
  }

  const url = new URL(request.url);
  const redirect = url.searchParams.get("redirect") || "";
  const plan = url.searchParams.get("plan") || "explorer";
  const mode = url.searchParams.get("mode") === "signup" ? "signup" : "login";

  const state = createOAuthState({ provider, redirect, plan, mode });
  const res = NextResponse.redirect(buildProviderAuthUrl(provider, state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, oauthStateCookieOptions());
  return res;
}

export async function POST(request: Request, { params }: Params) {
  return GET(request, { params });
}