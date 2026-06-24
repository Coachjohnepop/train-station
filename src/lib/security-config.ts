import "server-only";

import { isDemoMode } from "@/lib/demo-enrollments";

const DEV_SESSION_SECRET = "train-station-dev-session-secret-change-me";

/** Production-grade auth, passwords, and API enforcement. */
export function isSecurityEnforced(): boolean {
  if (process.env.SECURITY_ENFORCED === "true") return true;
  if (process.env.SECURITY_ENFORCED === "false") return false;
  return process.env.NODE_ENV === "production" && !isDemoMode();
}

export function allowBlankPasswordLogin(): boolean {
  if (process.env.ALLOW_BLANK_PASSWORD === "true") return true;
  if (process.env.ALLOW_BLANK_PASSWORD === "false") return false;
  return isDemoMode();
}

export function requireSignupPassword(): boolean {
  if (process.env.REQUIRE_SIGNUP_PASSWORD === "false") return false;
  return isSecurityEnforced();
}

export function allowDevUserSwitcher(): boolean {
  if (process.env.ALLOW_DEV_SWITCHER === "true") return true;
  return !isSecurityEnforced();
}

export function requireConfiguredSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret === DEV_SESSION_SECRET) {
    if (isSecurityEnforced()) {
      return null;
    }
    return secret || DEV_SESSION_SECRET;
  }
  return secret;
}

export function stripeRequiredInProduction(): boolean {
  if (process.env.STRIPE_REQUIRED !== "true") return false;
  return isSecurityEnforced();
}