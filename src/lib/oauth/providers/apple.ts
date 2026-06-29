import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";
import { oauthCallbackUrl } from "@/lib/oauth/config";
import type { OAuthProfile } from "@/lib/oauth/types";

const APPLE_AUTH = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN = "https://appleid.apple.com/auth/token";
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

let cachedClientSecret: { value: string; exp: number } | null = null;

async function appleClientSecret(): Promise<string> {
  const now = Date.now();
  if (cachedClientSecret && cachedClientSecret.exp > now + 60_000) {
    return cachedClientSecret.value;
  }

  const clientId = process.env.APPLE_CLIENT_ID!.trim();
  const teamId = process.env.APPLE_TEAM_ID!.trim();
  const keyId = process.env.APPLE_KEY_ID!.trim();
  const privateKey = process.env.APPLE_PRIVATE_KEY!.trim().replace(/\\n/g, "\n");

  const key = await importPKCS8(privateKey, "ES256");
  const exp = now + 150 * 24 * 60 * 60 * 1000;
  const secret = await new SignJWT({})
    .setAudience("https://appleid.apple.com")
    .setIssuer(teamId)
    .setSubject(clientId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(exp / 1000))
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .sign(key);

  cachedClientSecret = { value: secret, exp };
  return secret;
}

export function appleAuthUrl(state: string): string {
  const clientId = process.env.APPLE_CLIENT_ID!.trim();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthCallbackUrl("apple"),
    response_type: "code",
    scope: "name email",
    state,
    response_mode: "form_post",
  });
  return `${APPLE_AUTH}?${params.toString()}`;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "Member", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function appleProfileFromCode(
  code: string,
  userJson?: string | null,
): Promise<OAuthProfile> {
  const clientId = process.env.APPLE_CLIENT_ID!.trim();
  const clientSecret = await appleClientSecret();

  const tokenRes = await fetch(APPLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: oauthCallbackUrl("apple"),
      grant_type: "authorization_code",
    }),
  });

  const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
    id_token?: string;
    error?: string;
  };
  if (!tokenRes.ok || !tokenJson.id_token) {
    throw new Error(tokenJson.error || "Apple token exchange failed");
  }

  const verified = await jwtVerify(tokenJson.id_token, APPLE_JWKS, {
    audience: clientId,
    issuer: "https://appleid.apple.com",
  });

  const claims = verified.payload;
  const sub = typeof claims.sub === "string" ? claims.sub : "";
  const email = typeof claims.email === "string" ? claims.email : "";

  if (!sub || !email) {
    throw new Error("Apple did not return an email for this sign-in");
  }

  let firstName = "";
  let lastName = "";
  if (userJson) {
    try {
      const parsed = JSON.parse(userJson) as {
        name?: { firstName?: string; lastName?: string };
      };
      firstName = parsed.name?.firstName?.trim() || "";
      lastName = parsed.name?.lastName?.trim() || "";
    } catch {
      /* ignore malformed user payload */
    }
  }

  if (!firstName) firstName = splitName("").firstName;
  const name = [firstName, lastName].filter(Boolean).join(" ") || "Member";

  return {
    provider: "apple",
    providerUserId: sub,
    email,
    name,
    firstName: firstName || name,
    lastName,
  };
}