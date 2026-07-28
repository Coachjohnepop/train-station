import { WELCOME_VIDEO_PLAN_OPTIONS } from "@/lib/landing-media";
import type { WelcomeVideosByPlan } from "@/lib/landing-media-store";
import type { MembershipPlan } from "@/lib/signup-plans";

/** Slots where Jeremy’s uploaded intros can be assigned. */
export type CoachIntroSlotId =
  | "overall"
  | "free"
  | MembershipPlan;

export type CoachIntroSlotDef = {
  id: CoachIntroSlotId;
  label: string;
  hint: string;
};

export const COACH_INTRO_SLOTS: CoachIntroSlotDef[] = [
  {
    id: "overall",
    label: "Overall intro",
    hint: "Default welcome — home “Watch intro” and onboard when no ticket-specific clip.",
  },
  {
    id: "free",
    label: "Free-ticket intro",
    hint: "After the gag when someone taps Free / Explorer on the landing page.",
  },
  // Ticket classes in a friendly coach order (not raw plan enum order).
  {
    id: "explorer",
    label: "Free Explorer intro",
    hint: "Onboarding welcome for Free Explorer ticket holders.",
  },
  {
    id: "member",
    label: "Coach Class intro",
    hint: "Onboarding welcome for Coach Class members.",
  },
  {
    id: "business",
    label: "Business Class intro",
    hint: "Onboarding welcome for Business Class members.",
  },
  {
    id: "pro",
    label: "1st Class intro",
    hint: "Onboarding welcome for 1st Class members.",
  },
];

export type CoachIntroAssignments = {
  overall: string;
  free: string;
  byPlan: WelcomeVideosByPlan;
};

export function assignmentsFromLanding(input: {
  welcomeVideoUrl?: string | null;
  freeChastiseVideoUrl?: string | null;
  welcomeVideosByPlan?: WelcomeVideosByPlan;
}): CoachIntroAssignments {
  return {
    overall: input.welcomeVideoUrl?.trim() || "",
    free: input.freeChastiseVideoUrl?.trim() || "",
    byPlan: { ...(input.welcomeVideosByPlan || {}) },
  };
}

export function urlForSlot(
  slotId: CoachIntroSlotId,
  assignments: CoachIntroAssignments,
): string {
  if (slotId === "overall") return assignments.overall;
  if (slotId === "free") return assignments.free;
  return assignments.byPlan[slotId]?.trim() || "";
}

export function setSlotUrl(
  assignments: CoachIntroAssignments,
  slotId: CoachIntroSlotId,
  url: string,
): CoachIntroAssignments {
  const nextUrl = url.trim();
  if (slotId === "overall") return { ...assignments, overall: nextUrl };
  if (slotId === "free") return { ...assignments, free: nextUrl };
  return {
    ...assignments,
    byPlan: {
      ...assignments.byPlan,
      [slotId]: nextUrl || null,
    },
  };
}

/** Plan options used by older UIs — same labels as membership plans. */
export { WELCOME_VIDEO_PLAN_OPTIONS };
