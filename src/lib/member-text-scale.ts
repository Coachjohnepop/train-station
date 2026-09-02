/** In-app member text size. Survives reloads. Does not fight iOS Settings. */

export const MEMBER_TEXT_SCALE_KEY = "ts-member-text-scale";
export const MEMBER_TEXT_SCALES = ["xs", "sm", "md", "lg", "xl"] as const;
export type MemberTextScale = (typeof MEMBER_TEXT_SCALES)[number];

export const MEMBER_TEXT_SCALE_CHOICES: ReadonlyArray<{
  id: MemberTextScale;
  label: string;
  title: string;
}> = [
  { id: "xs", label: "A−−", title: "Smallest text" },
  { id: "sm", label: "A−", title: "Smaller text" },
  { id: "md", label: "A", title: "Default text" },
  { id: "lg", label: "A+", title: "Larger text" },
  { id: "xl", label: "A++", title: "Largest text" },
];

export function isMemberTextScale(value: unknown): value is MemberTextScale {
  return (
    value === "xs" ||
    value === "sm" ||
    value === "md" ||
    value === "lg" ||
    value === "xl"
  );
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

const HTML_FONT_PX: Record<MemberTextScale, string> = {
  xs: "12px",
  sm: "14px",
  md: "16px",
  lg: "20px",
  xl: "24px",
};

export function applyMemberTextScale(scale: MemberTextScale): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-ts-text-scale", scale);
  // Tailwind text-* is rem off <html>. Setting the root is what actually changes type.
  document.documentElement.style.fontSize = HTML_FONT_PX[scale];
  try {
    window.localStorage.setItem(MEMBER_TEXT_SCALE_KEY, scale);
  } catch {
    /* ignore */
  }
}
