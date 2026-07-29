import type { UserRole } from "@/lib/auth-session-edge";
import { isStaffRole } from "@/lib/staff-access";
import { isSignupPlan, normalizeSignupPlan } from "@/lib/signup-plans";

export type PurchaseAuth = {
  signedIn: boolean;
  role?: UserRole;
};

export type PurchaseOptions = {
  quote?: boolean;
};

function memberCheckoutPath(plan: string, options?: PurchaseOptions): string {
  const normalized = normalizeSignupPlan(plan);
  const params = new URLSearchParams();
  if (isSignupPlan(normalized)) params.set("plan", normalized);
  if (options?.quote) params.set("quote", "1");
  const qs = params.toString();
  return qs ? `/member/checkout?${qs}` : "/member/checkout";
}

function signupPath(plan: string, options?: PurchaseOptions): string {
  const normalized = normalizeSignupPlan(plan);
  const params = new URLSearchParams();
  params.set("plan", normalized);
  if (options?.quote) params.set("quote", "1");
  return `/signup?${params.toString()}`;
}

/** Where to send someone who wants to buy or enroll in a plan. */
export function purchaseHref(
  plan: string,
  auth: PurchaseAuth,
  options?: PurchaseOptions,
): string {
  const normalized = normalizeSignupPlan(plan);

  if (!auth.signedIn) {
    if (normalized === "custom_training") {
      const dest = encodeURIComponent(memberCheckoutPath("custom_training"));
      return `/login?redirect=${dest}`;
    }
    return signupPath(plan, options);
  }

  if (auth.role && isStaffRole(auth.role)) {
    return "/admin";
  }

  if (normalized === "explorer") {
    // Incomplete onboarding is enforced server-side; this lands free path on wizard entry.
    return "/member/onboard?plan=explorer";
  }

  return memberCheckoutPath(plan, options);
}