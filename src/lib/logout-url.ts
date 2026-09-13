/** Sign out and land on login with switch-account flow; preserve return path for staff/member areas. */
export function logoutUrl(): string {
  if (typeof window === "undefined") return "/api/auth/logout";
  const path = window.location.pathname;
  const t = Date.now();
  if (path.startsWith("/admin") || path.startsWith("/member")) {
    return `/api/auth/logout?redirect=${encodeURIComponent(path)}&t=${t}`;
  }
  return `/api/auth/logout?next=/login&t=${t}`;
}

/**
 * iPhone Safari ignores Set-Cookie on fetch(). Submit a real form POST so the
 * browser navigates, clears httpOnly cookies, and follows the 303 to login.
 */
export function signOutNow(): void {
  if (typeof document === "undefined") return;
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/auth/logout";
  form.style.display = "none";
  const path = window.location.pathname;
  if (path.startsWith("/admin") || path.startsWith("/member")) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "redirect";
    input.value = path;
    form.appendChild(input);
  } else {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "next";
    input.value = "/login";
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}