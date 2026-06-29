import { oauthCallbackUrl } from "@/lib/oauth/config";
import type { OAuthProfile } from "@/lib/oauth/types";

const FB_AUTH = "https://www.facebook.com/v21.0/dialog/oauth";
const FB_GRAPH = "https://graph.facebook.com/v21.0";

export function facebookAuthUrl(state: string): string {
  const clientId = process.env.FACEBOOK_CLIENT_ID!.trim();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthCallbackUrl("facebook"),
    response_type: "code",
    scope: "email,public_profile",
    state,
  });
  return `${FB_AUTH}?${params.toString()}`;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "Member", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function facebookProfileFromCode(code: string): Promise<OAuthProfile> {
  const clientId = process.env.FACEBOOK_CLIENT_ID!.trim();
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET!.trim();

  const tokenUrl = new URL(`${FB_GRAPH}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("redirect_uri", oauthCallbackUrl("facebook"));
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl, { cache: "no-store" });
  const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error?.message || "Facebook token exchange failed");
  }

  const profileUrl = new URL(`${FB_GRAPH}/me`);
  profileUrl.searchParams.set("fields", "id,name,email,first_name,last_name");
  profileUrl.searchParams.set("access_token", tokenJson.access_token);

  const profileRes = await fetch(profileUrl, { cache: "no-store" });
  const profileJson = (await profileRes.json().catch(() => ({}))) as {
    id?: string;
    email?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    error?: { message?: string };
  };

  if (!profileRes.ok || !profileJson.id || !profileJson.email) {
    throw new Error(profileJson.error?.message || "Facebook did not return an email");
  }

  const split = splitName(profileJson.name || "");
  const firstName = profileJson.first_name?.trim() || split.firstName;
  const lastName = profileJson.last_name?.trim() || split.lastName;
  const name = [firstName, lastName].filter(Boolean).join(" ") || profileJson.name || "Member";

  return {
    provider: "facebook",
    providerUserId: profileJson.id,
    email: profileJson.email,
    name,
    firstName,
    lastName,
  };
}