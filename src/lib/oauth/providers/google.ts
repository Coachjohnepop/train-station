import { createRemoteJWKSet, jwtVerify } from "jose";
import { oauthCallbackUrl } from "@/lib/oauth/config";
import type { OAuthProfile } from "@/lib/oauth/types";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function googleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthCallbackUrl("google"),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "Member", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function googleProfileFromCode(code: string): Promise<OAuthProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!.trim();

  const tokenRes = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: oauthCallbackUrl("google"),
      grant_type: "authorization_code",
    }),
  });

  const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
    id_token?: string;
    error?: string;
  };
  if (!tokenRes.ok || !tokenJson.id_token) {
    throw new Error(tokenJson.error || "Google token exchange failed");
  }

  const verified = await jwtVerify(tokenJson.id_token, GOOGLE_JWKS, {
    audience: clientId,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });

  const claims = verified.payload;
  const sub = typeof claims.sub === "string" ? claims.sub : "";
  const email = typeof claims.email === "string" ? claims.email : "";
  const emailVerified = claims.email_verified !== false;
  const given = typeof claims.given_name === "string" ? claims.given_name : "";
  const family = typeof claims.family_name === "string" ? claims.family_name : "";
  const fullName = typeof claims.name === "string" ? claims.name : "";

  if (!sub || !email || !emailVerified) {
    throw new Error("Google did not return a verified email");
  }

  const firstName = given || splitName(fullName).firstName;
  const lastName = family || splitName(fullName).lastName;
  const name = [firstName, lastName].filter(Boolean).join(" ") || fullName || "Member";

  return {
    provider: "google",
    providerUserId: sub,
    email,
    name,
    firstName,
    lastName,
  };
}