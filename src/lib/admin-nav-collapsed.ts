export const ADMIN_NAV_COLLAPSED_KEY = "ts-admin-nav-collapsed";

export function readAdminNavCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_NAV_COLLAPSED_KEY) === "1";
}

export function writeAdminNavCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_NAV_COLLAPSED_KEY, collapsed ? "1" : "0");
}