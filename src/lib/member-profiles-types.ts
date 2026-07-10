import type { ApprovalStatus, PaymentStatus } from "@/lib/member-gates";
import type { SignupPlan } from "@/lib/signup-plans";

export type PaymentMethod = "stripe" | "venmo" | "manual" | "other";

export type MemberProfile = {
  userId: string;
  email: string;
  plan: SignupPlan;
  phone: string | null;
  dailyReminderTime: string | null;
  weightLbs: string | null;
  notes: string | null;
  city: string | null;
  state: string | null;
  onboardingComplete: boolean;
  completedAt: string | null;
  approvalStatus: ApprovalStatus;
  approvedAt: string | null;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  paymentNote: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeCheckoutSessionId: string | null;
  referralCode: string | null;
  referredByUserId: string | null;
  intensiveSessionsTotal: number | null;
  intensiveSessionsRemaining: number | null;
  intensiveWindowDays: number | null;
  intensiveStartsAt: string | null;
  intensiveExpiresAt: string | null;
  customTrainingOfferId: string | null;
  welcomeSignupEmailSentAt: string | null;
  welcomeCompleteEmailSentAt: string | null;
  welcomeSmsSentAt: string | null;
  coachIntakeCompleteAt: string | null;
  coachIntakeCompletedBy: string | null;
  introBookedAt: string | null;
  coachMeetingRequestedAt: string | null;
  coachMeetingRequestedBy: string | null;
  coachMeetingRequestNote: string | null;
  rampStartedAt: string | null;
  updatedAt: string;
};

export type MemberProfilePatch = Partial<
  Pick<
    MemberProfile,
    | "phone"
    | "dailyReminderTime"
    | "weightLbs"
    | "notes"
    | "city"
    | "state"
    | "onboardingComplete"
    | "completedAt"
    | "plan"
    | "welcomeSignupEmailSentAt"
    | "welcomeCompleteEmailSentAt"
    | "welcomeSmsSentAt"
    | "coachIntakeCompleteAt"
    | "coachIntakeCompletedBy"
    | "introBookedAt"
    | "coachMeetingRequestedAt"
    | "coachMeetingRequestedBy"
    | "coachMeetingRequestNote"
    | "rampStartedAt"
    | "approvalStatus"
    | "approvedAt"
    | "paymentStatus"
    | "paidAt"
    | "paymentMethod"
    | "paymentNote"
    | "stripeCustomerId"
    | "stripeSubscriptionId"
    | "stripeCheckoutSessionId"
    | "referralCode"
    | "referredByUserId"
    | "intensiveSessionsTotal"
    | "intensiveSessionsRemaining"
    | "intensiveWindowDays"
    | "intensiveStartsAt"
    | "intensiveExpiresAt"
    | "customTrainingOfferId"
  >
>;