import type { MemberTier } from "@/lib/access";
import { SERVICE_OFFER_IDS } from "@/lib/product-offers";

export const MEMBERSHIP_PLANS = ["explorer", "member", "pro", "business"] as const;

export type MembershipPlan = (typeof MEMBERSHIP_PLANS)[number];

export const SIGNUP_PLANS = [...MEMBERSHIP_PLANS, ...SERVICE_OFFER_IDS] as const;
export type SignupPlan = (typeof SIGNUP_PLANS)[number];

export function normalizeSignupPlan(raw: string | null | undefined): SignupPlan {
  const v = (raw || "").trim().toLowerCase().replace(/-/g, "_");
  if (v === "member" || v === "coach_class") return "member";
  if (
    v === "pro" ||
    v === "first_class" ||
    v === "first_class_1on1" ||
    v === "first_class_1_on_1" ||
    v === "1on1" ||
    v === "intensive"
  ) {
    return "pro";
  }
  if (v === "business" || v === "business_class") return "business";
  if (v === "team_consultation" || v === "team_consult") return "team_consultation";
  if (v === "speaking_fee" || v === "speaking") return "speaking_fee";
  if (v === "custom_training" || v === "custom") return "custom_training";
  if (v === "merchandise" || v === "merch") return "merchandise";
  if ((SIGNUP_PLANS as readonly string[]).includes(v)) return v as SignupPlan;
  return "explorer";
}

export function signupPlanLabel(plan: SignupPlan): string {
  switch (plan) {
    case "member":
      return "Coach Class";
    case "pro":
      return "1st Class";
    case "business":
      return "Business Class";
    case "team_consultation":
      return "Team Consultation Program";
    case "speaking_fee":
      return "Speaking Fee Program";
    case "custom_training":
      return "Custom Priced Training";
    case "merchandise":
      return "Merchandise";
    default:
      return "Free Explorer";
  }
}

export function isSignupPlan(value: string): value is SignupPlan {
  return (SIGNUP_PLANS as readonly string[]).includes(value);
}

export function signupPlanToMemberTier(plan: SignupPlan): MemberTier {
  if (plan === "pro" || plan === "business") {
    return "first_class";
  }
  return "coach";
}