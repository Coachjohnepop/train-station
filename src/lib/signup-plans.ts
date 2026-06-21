import type { MemberTier } from "@/lib/access";

export const SIGNUP_PLANS = ["explorer", "member", "pro"] as const;
export type SignupPlan = (typeof SIGNUP_PLANS)[number];

export function normalizeSignupPlan(raw: string | null | undefined): SignupPlan {
  const v = (raw || "").trim().toLowerCase();
  if (v === "member" || v === "coach-class" || v === "coach_class") return "member";
  if (v === "pro" || v === "first-class" || v === "first_class") return "pro";
  return "explorer";
}

export function signupPlanLabel(plan: SignupPlan): string {
  switch (plan) {
    case "member":
      return "Coach Class";
    case "pro":
      return "1st Class";
    default:
      return "Free Explorer";
  }
}

export function isSignupPlan(value: string): value is SignupPlan {
  return (SIGNUP_PLANS as readonly string[]).includes(value);
}

export function signupPlanToMemberTier(plan: SignupPlan): MemberTier {
  if (plan === "pro") return "first_class";
  return "coach";
}