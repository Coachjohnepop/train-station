import { addDaysIso } from "@/lib/workout-day-visibility";

/** Tester-only: start their 28-day month so today is Day 2 (Lower Body). */
const START_ON_DAY_TWO_EMAILS = new Set(["dubl-e@howerfamily.com"]);

export function isStartOnDayTwoEmail(email?: string | null): boolean {
  return START_ON_DAY_TWO_EMAILS.has(String(email || "").trim().toLowerCase());
}

/** Day-1 calendar date for a new enrollment. Todd: yesterday so today is Lower Body. */
export function enrollmentStartIsoForEmail(
  email: string | null | undefined,
  todayIso: string,
  explicitStartIso?: string | null,
): string {
  if (isStartOnDayTwoEmail(email)) return addDaysIso(todayIso, -1);
  const explicit = explicitStartIso?.trim();
  if (explicit) return explicit;
  return todayIso;
}
