export const ADMIN_NAV_HIDDEN_KEY = "ts-admin-nav-hidden";

export function readAdminNavHidden(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_NAV_HIDDEN_KEY) === "1";
}

export function writeAdminNavHidden(hidden: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_NAV_HIDDEN_KEY, hidden ? "1" : "0");
}
