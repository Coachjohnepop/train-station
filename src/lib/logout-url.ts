/** Sign out and land on login with switch-account flow; preserve return path for staff/member areas. */
export function logoutUrl(): string {
  if (typeof window === "undefined") return "/api/auth/logout";
  const path = window.location.pathname;
  if (path.startsWith("/admin") || path.startsWith("/member")) {
    return `/api/auth/logout?redirect=${encodeURIComponent(path)}`;
  }
  return "/api/auth/logout?next=/login";
}

/** POST first so CDNs cannot cache a GET 302 that skips clearing the session. */
export function signOutNow(): void {
  const next = logoutUrl();
  void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
    .catch(() => undefined)
    .finally(() => {
      window.location.href = next;
    });
}