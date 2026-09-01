/**
 * Theme Song is a guest-only landing / explore / join thing.
 * After a login exists it is off the app — no speaker, no autoplay, no mute control.
 * /login is excluded: the corner mute sat on the PIN pad and ate digit taps.
 */

const GUEST_PREFIXES = [
  "/landing",
  "/join",
  "/signup",
  "/pricing",
  "/coming-soon",
  "/free",
  "/forgot-password",
  "/reset-password",
  "/find",
  "/jeremy",
  "/fitness",
  "/powered-by",
  "/privacy",
  "/terms",
  "/setup-quick-auth",
] as const;

export function isGuestThemeSongPath(pathname: string): boolean {
  const p = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (p === "/") return true;
  return GUEST_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/** True only for signed-out visitors on public explore / create-login paths. */
export function allowThemeSong(pathname: string, signedIn: boolean): boolean {
  if (signedIn) return false;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return false;
  if (pathname === "/member" || pathname.startsWith("/member/")) return false;
  return isGuestThemeSongPath(pathname);
}
