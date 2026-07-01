import type { UserRole } from "@/lib/auth-session";
import {
  defaultCoachAdminPath,
  defaultPlatformAdminPath,
  isPlatformAdminPath,
} from "@/lib/admin-nav-sections";

export { isPlatformAdminPath };

/** Coach workspace — programs, members, messages, day-to-day coaching. */
export function canAccessCoachAdmin(role: UserRole): boolean {
  return role === "ADMIN" || role === "INSTRUCTOR";
}

/** Platform workspace — payments, pricing, users, reports. */
export function canAccessPlatformAdmin(role: UserRole): boolean {
  return role === "ADMIN" || role === "PLATFORM_ADMIN";
}

/** Full staff — used for middleware and member impersonation. */
export function isStaffRole(role: UserRole): boolean {
  return canAccessCoachAdmin(role) || canAccessPlatformAdmin(role);
}

/** Both workspaces — show Coach | Platform tabs in admin header. */
export function hasDualStaffWorkspace(role: UserRole): boolean {
  return role === "ADMIN";
}

export function defaultStaffLandingPath(role: UserRole): string {
  if (role === "PLATFORM_ADMIN") return defaultPlatformAdminPath();
  return defaultCoachAdminPath();
}

/** Coaches start on My class — not the old dashboard or queue. */
export function normalizeCoachLoginRedirect(redirect: string | null | undefined): string {
  const raw = redirect?.trim();
  if (!raw) return defaultCoachAdminPath();
  if (raw === "/admin" || raw === "/admin/") return defaultCoachAdminPath();
  if (raw.startsWith("/admin/queue")) return defaultCoachAdminPath();
  return raw.startsWith("/admin") ? raw : defaultCoachAdminPath();
}

export function staffWorkspaceLabel(role: UserRole): string {
  if (hasDualStaffWorkspace(role)) return "Staff";
  if (role === "PLATFORM_ADMIN") return "Platform admin";
  if (role === "INSTRUCTOR") return "Coach";
  return "Staff";
}

export function staffRoleDescription(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "Coach + platform — both workspace tabs";
    case "INSTRUCTOR":
      return "Coach only — programs, members, messages";
    case "PLATFORM_ADMIN":
      return "Platform only — payments, users, site ops";
    default:
      return role;
  }
}

/** Redirect platform-only staff away from coach admin URLs (and vice versa). */
export function staffAdminRedirect(pathname: string, role: UserRole): string | null {
  if (!pathname.startsWith("/admin")) return null;

  if (isPlatformAdminPath(pathname) && !canAccessPlatformAdmin(role)) {
    return defaultCoachAdminPath();
  }

  if (!isPlatformAdminPath(pathname) && !canAccessCoachAdmin(role)) {
    return defaultPlatformAdminPath();
  }

  return null;
}