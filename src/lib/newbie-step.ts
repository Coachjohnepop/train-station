import { normalizeSignupPlan } from "@/lib/signup-plans";
import {
  MEMBER_PENDING_PATH,
  memberCheckoutPath,
  memberFreePaymentSetupPath,
} from "@/lib/member-route-gates";
import { memberOnboardEntryPath, memberTodayEntryPath } from "@/lib/member-app-entry";

const FIRST_TAPE_PATH = "/member/measurements?first=1";

export type NewbieResolveInput = {
  plan?: string | null;
  onboardingComplete: boolean;
  paymentStatus?: string | null;
  needsPayment: boolean;
  needsFreePm: boolean;
  needsApproval: boolean;
  needsFirstTape: boolean;
};

/**
 * One next URL after signup / login / finish setup.
 * Never returns the /member router hop — always a concrete screen.
 */
export function nextNewbieHref(input: NewbieResolveInput): string {
  const plan = normalizeSignupPlan(input.plan);

  if (plan === "speaking_fee" && !input.onboardingComplete) {
    return "/member/speaking";
  }
  if (
    (plan === "team_consultation" || plan === "custom_training") &&
    !input.onboardingComplete
  ) {
    return `/member/quote-received?plan=${encodeURIComponent(plan)}`;
  }

  if (input.needsPayment) return memberCheckoutPath(plan);
  if (input.needsFreePm) return memberFreePaymentSetupPath();
  if (input.needsApproval) return MEMBER_PENDING_PATH;

  if (!input.onboardingComplete) {
    if (
      input.paymentStatus === "paid" &&
      plan !== "explorer" &&
      (plan === "member" || plan === "business" || plan === "pro")
    ) {
      return memberCheckoutPath(plan);
    }
    return memberOnboardEntryPath(plan);
  }

  if (input.needsFirstTape) return FIRST_TAPE_PATH;
  return memberTodayEntryPath();
}

export function isNewbieSetupPath(pathname: string): boolean {
  return (
    pathname.startsWith("/member/onboard") ||
    pathname.startsWith("/member/speaking") ||
    pathname.startsWith("/member/payment-setup") ||
    pathname.startsWith("/member/quote-received") ||
    pathname.startsWith("/member/checkout")
  );
}
