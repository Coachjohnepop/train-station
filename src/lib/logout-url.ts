/** Sign out and land on login with switch-account flow; preserve return path for staff/member areas. */
export function logoutUrl(): string {
  if (typeof window === "undefined") return "/api/auth/logout";
  const path = window.location.pathname;
  if (path.startsWith("/admin") || path.startsWith("/member")) {
    return `/api/auth/logout?redirect=${encodeURIComponent(path)}`;
  }
  return "/api/auth/logout";
}