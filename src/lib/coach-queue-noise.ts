import { isGuestStubEmail, isPlaceholderGuestUsername } from "@/lib/byow-username";
import { isStandingStaffGrantEmail } from "@/lib/staff-grant-standing";

/** Guest stubs and house testers — not coach work. */
export function isCoachQueueNoise(input: {
  email?: string | null;
  name?: string | null;
  hidden?: boolean | null;
}): boolean {
  if (input.hidden) return true;
  if (isGuestStubEmail(input.email)) return true;
  if (isPlaceholderGuestUsername(input.name)) return true;
  if (isStandingStaffGrantEmail(input.email)) return true;
  return false;
}
