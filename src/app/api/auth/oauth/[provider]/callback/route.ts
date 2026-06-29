import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appBaseUrl, oauthProviderEnabled, parseOAuthProvider } from "@/lib/oauth/config";
import { completeOAuthSignIn } from "@/lib/oauth/complete-sign-in";
import { profileFromProviderCode } from "@/lib/oauth/provider-flow";
import { verifyOAuthState } from "@/lib/oauth/state";
import { OAUTH_STATE_COOKIE } from "@/lib/oauth/config";

type Params = { params: Promise<{ provider: string }> };

async function readCallbackInput(
  request: Request,
  provider: ReturnType<typeof parseOAuthProvider>,
): Promise<{ code: string | null; state: string | null; appleUserJson: string | null; error: string | null }> {
  if (provider === "apple" && request.method === "POST") {
    const form = await request.formData();
    return {
      code: String(form.get("code") || "") || null,
      state: String(form.get("state") || "") || null,
      appleUserJson: String(form.get("user") || "") || null,
      error: String(form.get("error") || "") || null,
    };
  }

  const url = new URL(request.url);
  return {
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    appleUserJson: null,
    error: url.searchParams.get("error"),
  };
}

async function handleCallback(request: Request, rawProvider: string) {
  const provider = parseOAuthProvider(rawProvider);
  if (!provider || !oauthProviderEnabled(provider)) {
    return oauthFail("unavailable");
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });

  const { code, state, appleUserJson, error } = await readCallbackInput(request, provider);
  if (error) return oauthFail(error);
  if (!code || !state || !stateCookie) return oauthFail("invalid_state");

  const statePayload = verifyOAuthState(state);
  if (!statePayload || state !== stateCookie || statePayload.provider !== provider) {
    return oauthFail("invalid_state");
  }

  try {
    const profile = await profileFromProviderCode(provider, code, { appleUserJson });
    return completeOAuthSignIn(profile, {
      redirect: statePayload.redirect,
      plan: statePayload.plan,
    });
  } catch (e: unknown) {
    console.error("OAuth callback failed", provider, e);
    return oauthFail("provider_error");
  }
}

function oauthFail(code: string) {
  const url = new URL("/login", appBaseUrl());
  url.searchParams.set("oauthError", code);
  return NextResponse.redirect(url);
}

export async function GET(request: Request, { params }: Params) {
  const { provider } = await params;
  return handleCallback(request, provider);
}

export async function POST(request: Request, { params }: Params) {
  const { provider } = await params;
  return handleCallback(request, provider);
}