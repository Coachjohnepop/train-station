import type { ApprovalStatus, PaymentStatus } from "@/lib/member-gates";
import type { SignupPlan } from "@/lib/signup-plans";

/** card_on_file = Free Explorer saved a card via Setup (not charged). */
export type PaymentMethod = "stripe" | "venmo" | "manual" | "other" | "card_on_file";

export type MemberProfile = {
  userId: string;
  email: string;
  plan: SignupPlan;
  phone: string | null;
  dailyReminderTime: string | null;
  weightLbs: string | null;
  gender: string | null;
  weightLossGoal: string | null;
  weightLossTimeline: string | null;
  primaryGoal: string | null;
  workoutSchedule: string | null;
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
  /** ISO — staff grant must be reapproved by this time (usually 1st of next month). */
  staffGrantExpiresAt: string | null;
  staffGrantedAt: string | null;
  staffGrantedBy: string | null;
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
    | "gender"
    | "weightLossGoal"
    | "weightLossTimeline"
    | "primaryGoal"
    | "workoutSchedule"
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
    | "staffGrantExpiresAt"
    | "staffGrantedAt"
    | "staffGrantedBy"
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