/**
 * Member access control — preview mode grants full access.
 * Set MEMBER_ACCESS_MODE=enforced in .env when Stripe tiers are live.
 */

export type MemberTier = "starter" | "first_class";

export type MemberFeature =
  | "programs"
  | "workout_player"
  | "live_sessions"
  | "premium_programs";

export type MemberAccess = {
  tier: MemberTier;
  /** When true, all features unlock (current default). */
  isPreview: boolean;
  tierLabel: string;
  canAccessProgram: (program: { tierSlug: string }) => boolean;
  canAccessFeature: (feature: MemberFeature) => boolean;
};

export type ProgramAccessState = "included" | "upgrade";

function isEnforced(): boolean {
  return process.env.MEMBER_ACCESS_MODE === "enforced";
}

export function getMemberAccess(tier: MemberTier = "first_class"): MemberAccess {
  const isPreview = !isEnforced();

  return {
    tier,
    isPreview,
    tierLabel: tier === "first_class" ? "1st Class" : "Starter",
    canAccessProgram(program) {
      if (isPreview) return true;
      if (program.tierSlug === "starter") return true;
      return tier === "first_class";
    },
    canAccessFeature(_feature) {
      if (isPreview) return true;
      if (_feature === "programs" || _feature === "workout_player") {
        return true;
      }
      return tier === "first_class";
    },
  };
}

export function getProgramAccessState(
  program: { tierSlug: string },
  access: MemberAccess,
): ProgramAccessState {
  if (access.canAccessProgram(program)) return "included";
  return "upgrade";
}