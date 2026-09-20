/** Auto-minted names from See the program → Let’s begin. */
export function isPlaceholderGuestUsername(name: string | null | undefined): boolean {
  return /^Guest[a-z0-9]{6,}$/i.test((name || "").trim());
}

export const GUEST_STEP_EVENT = "ts-guest-workout-step";
export const GUEST_SAVE_AFTER_STEPS = 3;
