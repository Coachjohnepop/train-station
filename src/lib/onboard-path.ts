export const ONBOARD_GENDERS = ["man", "woman"] as const;
export type OnboardGender = (typeof ONBOARD_GENDERS)[number];

export const WEIGHT_LOSS_TIMELINES = [
  "8 weeks",
  "12 weeks",
  "16 weeks",
  "6 months",
] as const;

export function normalizeOnboardGender(raw: string | null | undefined): OnboardGender | null {
  const v = (raw || "").trim().toLowerCase();
  if (v === "man" || v === "male" || v === "m") return "man";
  if (v === "woman" || v === "female" || v === "f") return "woman";
  return null;
}

export function isWomanOnboardPath(gender: string | null | undefined): boolean {
  return normalizeOnboardGender(gender) === "woman";
}
