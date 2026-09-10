/**
 * Theme Song is a guest-only landing / explore / join thing.
 * After a login exists it is off the app — no speaker, no autoplay, no mute control.
 * Login / forgot / reset stay silent so the song and mute chip cannot cover the PIN pad.
 */

const GUEST_PREFIXES = [
  "/landing",
  "/join",
  "/signup",
  "/pricing",
  "/coming-soon",
  "/free",
  "/find",
  "/jeremy",
  "/fitness",
  "/powered-by",
  "/privacy",
  "/terms",
  "/setup-quick-auth",
] as const;

/** Auth screens — never Theme Song, even if they look like public guest pages. */
const SILENT_PREFIXES = ["/login", "/forgot-password", "/reset-password"] as const;

function normalizePath(pathname: string): string {
  return (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isGuestThemeSongPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  if (SILENT_PREFIXES.some((prefix) => matchesPrefix(p, prefix))) return false;
  if (p === "/") return true;
  return GUEST_PREFIXES.some((prefix) => matchesPrefix(p, prefix));
}

function isStaffRoleName(role?: string | null): boolean {
  return role === "ADMIN" || role === "INSTRUCTOR" || role === "PLATFORM_ADMIN";
}

/**
 * Guests on public pages, and staff previewing those same pages.
 * Members and admin/member apps stay silent.
 */
export function allowThemeSong(
  pathname: string,
  signedIn: boolean,
  role?: string | null,
): boolean {
  const p = normalizePath(pathname);
  if (SILENT_PREFIXES.some((prefix) => matchesPrefix(p, prefix))) return false;
  if (p === "/admin" || p.startsWith("/admin/")) return false;
  if (p === "/member" || p.startsWith("/member/")) return false;
  if (!isGuestThemeSongPath(p)) return false;
  if (!signedIn) return true;
  return isStaffRoleName(role);
}
