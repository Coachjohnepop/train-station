/** Desktop admin sidebar width (px) — browser only; mobile uses drawer. */

export const ADMIN_NAV_WIDTH_KEY = "ts-admin-nav-width";

export const ADMIN_NAV_WIDTH_DEFAULT = 224; // ~w-56
export const ADMIN_NAV_WIDTH_COLLAPSED = 68; // ~4.25rem
export const ADMIN_NAV_WIDTH_MIN = 180;
export const ADMIN_NAV_WIDTH_MAX = 420;

export function clampAdminNavWidth(px: number): number {
  const max =
    typeof window !== "undefined"
      ? Math.min(ADMIN_NAV_WIDTH_MAX, Math.floor(window.innerWidth * 0.45))
      : ADMIN_NAV_WIDTH_MAX;
  return Math.min(max, Math.max(ADMIN_NAV_WIDTH_MIN, Math.round(px)));
}

export function readAdminNavWidth(): number {
  if (typeof window === "undefined") return ADMIN_NAV_WIDTH_DEFAULT;
  const raw = localStorage.getItem(ADMIN_NAV_WIDTH_KEY);
  if (!raw) return ADMIN_NAV_WIDTH_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return ADMIN_NAV_WIDTH_DEFAULT;
  return clampAdminNavWidth(n);
}

export function writeAdminNavWidth(px: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_NAV_WIDTH_KEY, String(clampAdminNavWidth(px)));
}
