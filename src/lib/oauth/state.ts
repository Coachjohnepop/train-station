import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { OAuthMode, OAuthProvider, OAuthStatePayload } from "@/lib/oauth/types";
import { resolveSessionSecret } from "@/lib/session-secret";
import { OAUTH_STATE_COOKIE } from "@/lib/oauth/config";

const STATE_TTL_MS = 10 * 60 * 1000;

function sign(body: string): string {
  return createHmac("sha256", resolveSessionSecret()).update(body).digest("base64url");
}

export function createOAuthState(input: {
  provider: OAuthProvider;
  redirect?: string;
  plan?: string;
  mode?: OAuthMode;
}): string {
  const payload: OAuthStatePayload = {
    provider: input.provider,
    redirect: sanitizeRedirect(input.redirect),
    plan: input.plan?.trim() || "explorer",
    mode: input.mode === "signup" ? "signup" : "login",
    nonce: randomBytes(16).toString("base64url"),
    exp: Date.now() + STATE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyOAuthState(token: string): OAuthStatePayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (!payload.provider || !payload.nonce) return null;
    return payload;
  } catch {
    return null;
  }
}

export function oauthStateCookieOptions(maxAgeSec = 600) {
  return {
    name: OAUTH_STATE_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  };
}

function sanitizeRedirect(redirect?: string): string {
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) return "";
  return redirect;
}