export type OAuthProvider = "google" | "apple" | "facebook";

export type OAuthMode = "login" | "signup";

export type OAuthProfile = {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
};

export type OAuthStatePayload = {
  provider: OAuthProvider;
  redirect: string;
  plan: string;
  mode: OAuthMode;
  nonce: string;
  exp: number;
};