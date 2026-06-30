/** Remember last in-app URL so mobile reopen lands where the user left off. */

export const MEMBER_RESUME_KEY = "ts-member-resume-path";
export const COACH_RESUME_KEY = "ts-coach-resume-path";

const MEMBER_SKIP_PREFIXES = ["/member/checkout", "/member/onboard", "/member/pending"];

export function isSaveableMemberPath(pathname: string): boolean {
  if (!pathname.startsWith("/member/")) return false;
  return !MEMBER_SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isSaveableCoachPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function defaultMemberResumePath(): string {
  return "/member/today";
}

export function defaultCoachResumePath(mobile: boolean): string {
  return mobile ? "/admin/queue" : "/admin";
}

export function readStoredResumePath(key: string, validate: (path: string) => boolean): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw?.startsWith("/")) return null;
    const pathname = raw.split("?")[0] ?? raw;
    return validate(pathname) ? raw : null;
  } catch {
    return null;
  }
}

export function storeResumePath(key: string, fullPath: string, validate: (path: string) => boolean) {
  if (typeof window === "undefined") return;
  const pathname = fullPath.split("?")[0] ?? fullPath;
  if (!validate(pathname)) return;
  try {
    localStorage.setItem(key, fullPath);
  } catch {
    /* ignore quota / private mode */
  }
}