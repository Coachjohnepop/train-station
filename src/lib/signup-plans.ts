import type { MemberTier } from "@/lib/access";
import { SERVICE_OFFER_IDS } from "@/lib/product-offers";

export const MEMBERSHIP_PLANS = ["explorer", "member", "pro", "business"] as const;

export type MembershipPlan = (typeof MEMBERSHIP_PLANS)[number];

/** Paid membership tiers ordered low → high for upgrade/downgrade rules. */
export const PAID_MEMBERSHIP_PLANS = ["member", "business", "pro"] as const satisfies readonly MembershipPlan[];

const MEMBERSHIP_PLAN_RANK: Record<MembershipPlan, number> = {
  explorer: 0,
  member: 1,
  business: 2,
  pro: 3,
};

export function isMembershipPlan(plan: SignupPlan): plan is MembershipPlan {
  return (MEMBERSHIP_PLANS as readonly string[]).includes(plan);
}

export function membershipPlanRank(plan: SignupPlan): number | null {
  return isMembershipPlan(plan) ? MEMBERSHIP_PLAN_RANK[plan] : null;
}

/** Higher tiers only — used at signup checkout (no downgrades during setup). */
export function upgradeMembershipPlansFrom(plan: SignupPlan): MembershipPlan[] {
  const rank = membershipPlanRank(plan);
  if (rank === null) return [];
  return PAID_MEMBERSHIP_PLANS.filter((candidate) => MEMBERSHIP_PLAN_RANK[candidate] > rank);
}

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