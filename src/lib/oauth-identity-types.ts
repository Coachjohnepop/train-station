import type { OAuthProvider } from "@/lib/oauth/types";

export type StoredOAuthIdentity = {
  provider: OAuthProvider;
  providerUserId: string;
  userId: string;
  email: string;
  linkedAt: string;
};

export function oauthIdentityKey(provider: OAuthProvider, providerUserId: string): string {
  return `${provider}:${providerUserId}`;
}