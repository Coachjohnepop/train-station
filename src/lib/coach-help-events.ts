export const COACH_HELP_OPEN_EVENT = "coach-help-open";

export function openCoachHelpPanel(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COACH_HELP_OPEN_EVENT));
}