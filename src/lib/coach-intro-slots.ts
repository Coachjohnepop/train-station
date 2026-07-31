import { WELCOME_VIDEO_PLAN_OPTIONS } from "@/lib/landing-media";
import type { WelcomeVideosByPlan } from "@/lib/landing-media-store";
import type { MembershipPlan } from "@/lib/signup-plans";

/**
 * Slots where Jeremy’s uploaded intros can be assigned.
 * Free path = one slot only (Free Explorer) for Free button after gag + onboard.
 */
export type CoachIntroSlotId =
  | "overall"
  | "free"
  | "equipment"
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
    label: "Free Explorer intro",
    hint: "One clip for Free: after the rickroll on Free ticket, and on Free Explorer onboard. No second free upload.",
  },
  {
    id: "equipment",
    label: "Gear / equipment intro",
    hint: "First time a member opens Gear — purpose of the tab and how to think about home-gym buys.",
  },
  // Paid classes only (explorer merged into free slot above)
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
  /** Unified Free Explorer video (free-ticket modal + explorer plan onboard). */
  free: string;
  equipment: string;
  byPlan: WelcomeVideosByPlan;
};

/** Merge freeChastise + byPlan.explorer into one free URL for admin + product. */
export function resolveFreeExplorerVideoUrl(input: {
  freeChastiseVideoUrl?: string | null;
  welcomeVideosByPlan?: WelcomeVideosByPlan;
}): string {
  const free = input.freeChastiseVideoUrl?.trim() || "";
  const explorer = input.welcomeVideosByPlan?.explorer?.trim() || "";
  return free || explorer || "";
}

export function assignmentsFromLanding(input: {
  welcomeVideoUrl?: string | null;
  freeChastiseVideoUrl?: string | null;
  equipmentIntroVideoUrl?: string | null;
  welcomeVideosByPlan?: WelcomeVideosByPlan;
}): CoachIntroAssignments {
  const byPlan = { ...(input.welcomeVideosByPlan || {}) };
  const freeUrl = resolveFreeExplorerVideoUrl({
    freeChastiseVideoUrl: input.freeChastiseVideoUrl,
    welcomeVideosByPlan: byPlan,
  });
  // Keep explorer in byPlan in sync for onboard welcomeVideoUrlForPlan
  if (freeUrl) {
    byPlan.explorer = freeUrl;
  }
  return {
    overall: input.welcomeVideoUrl?.trim() || "",
    free: freeUrl,
    equipment: input.equipmentIntroVideoUrl?.trim() || "",
    byPlan,
  };
}

export function urlForSlot(
  slotId: CoachIntroSlotId,
  assignments: CoachIntroAssignments,
): string {
  if (slotId === "overall") return assignments.overall;
  if (slotId === "free" || slotId === "explorer") return assignments.free;
  if (slotId === "equipment") return assignments.equipment;
  return assignments.byPlan[slotId]?.trim() || "";
}

export function setSlotUrl(
  assignments: CoachIntroAssignments,
  slotId: CoachIntroSlotId,
  url: string,
): CoachIntroAssignments {
  const nextUrl = url.trim();
  if (slotId === "overall") return { ...assignments, overall: nextUrl };
  if (slotId === "equipment") return { ...assignments, equipment: nextUrl };
  // free + explorer always write the same Free Explorer clip
  if (slotId === "free" || slotId === "explorer") {
    return {
      ...assignments,
      free: nextUrl,
      byPlan: {
        ...assignments.byPlan,
        explorer: nextUrl || null,
      },
    };
  }
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
