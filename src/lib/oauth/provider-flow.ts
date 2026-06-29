import type { OAuthProvider } from "@/lib/oauth/types";
import { appleAuthUrl, appleProfileFromCode } from "@/lib/oauth/providers/apple";
import { facebookAuthUrl, facebookProfileFromCode } from "@/lib/oauth/providers/facebook";
import { googleAuthUrl, googleProfileFromCode } from "@/lib/oauth/providers/google";

export function buildProviderAuthUrl(provider: OAuthProvider, state: string): string {
  switch (provider) {
    case "google":
      return googleAuthUrl(state);
    case "apple":
      return appleAuthUrl(state);
    case "facebook":
      return facebookAuthUrl(state);
  }
}

export async function profileFromProviderCode(
  provider: OAuthProvider,
  code: string,
  extras?: { appleUserJson?: string | null },
) {
  switch (provider) {
    case "google":
      return googleProfileFromCode(code);
    case "apple":
      return appleProfileFromCode(code, extras?.appleUserJson);
    case "facebook":
      return facebookProfileFromCode(code);
  }
}