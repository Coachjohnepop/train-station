import { isStaffRole, type UserRole } from "@/lib/auth-session";
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
    return "/member";
  }

  return memberCheckoutPath(plan, options);
}