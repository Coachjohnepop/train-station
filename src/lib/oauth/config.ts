import type { OAuthProvider } from "@/lib/oauth/types";

export const OAUTH_STATE_COOKIE = "ts_oauth_state";

export function appBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function oauthCallbackUrl(provider: OAuthProvider): string {
  return `${appBaseUrl()}/api/auth/oauth/${provider}/callback`;
}

export function oauthProviderEnabled(provider: OAuthProvider): boolean {
  switch (provider) {
    case "google":
      return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
    case "apple":
      return Boolean(
        process.env.APPLE_CLIENT_ID?.trim() &&
          process.env.APPLE_TEAM_ID?.trim() &&
          process.env.APPLE_KEY_ID?.trim() &&
          process.env.APPLE_PRIVATE_KEY?.trim(),
      );
    case "facebook":
      return Boolean(
        process.env.FACEBOOK_CLIENT_ID?.trim() && process.env.FACEBOOK_CLIENT_SECRET?.trim(),
      );
    default:
      return false;
  }
}

export function listEnabledOAuthProviders(): OAuthProvider[] {
  return (["google", "apple", "facebook"] as const).filter((p) => oauthProviderEnabled(p));
}

export function parseOAuthProvider(raw: string): OAuthProvider | null {
  if (raw === "google" || raw === "apple" || raw === "facebook") return raw;
  return null;
}

export function oauthProviderLabel(provider: OAuthProvider): string {
  switch (provider) {
    case "google":
      return "Google";
    case "apple":
      return "Apple";
    case "facebook":
      return "Facebook";
  }
}