/** In-app member text size. Survives reloads. Does not fight iOS Settings. */

export const MEMBER_TEXT_SCALE_KEY = "ts-member-text-scale";
export const MEMBER_TEXT_SCALES = ["sm", "md", "lg"] as const;
export type MemberTextScale = (typeof MEMBER_TEXT_SCALES)[number];

export function isMemberTextScale(value: unknown): value is MemberTextScale {
  return value === "sm" || value === "md" || value === "lg";
}

export function readMemberTextScale(): MemberTextScale {
  if (typeof window === "undefined") return "md";
  try {
    const v = window.localStorage.getItem(MEMBER_TEXT_SCALE_KEY);
    if (isMemberTextScale(v)) return v;
  } catch {
    /* ignore */
  }
  return "md";
}

export function applyMemberTextScale(scale: MemberTextScale): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-ts-text-scale", scale);
  try {
    window.localStorage.setItem(MEMBER_TEXT_SCALE_KEY, scale);
  } catch {
    /* ignore */
  }
}
