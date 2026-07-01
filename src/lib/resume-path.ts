/** Remember last in-app URL so mobile reopen lands where the user left off. */

export const MEMBER_RESUME_KEY = "ts-member-resume-path";
export const COACH_RESUME_KEY = "ts-coach-resume-path";

const MEMBER_SKIP_PREFIXES = ["/member/checkout", "/member/onboard", "/member/pending"];

/** Coach-only query params — never resume members into instructor view. */
const MEMBER_STRIP_PARAMS = ["asInstructor", "forUser"];

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

export function defaultCoachResumePath(_mobile: boolean): string {
  return "/admin/day";
}

/**
 * Normalize a stored resume target to a safe relative path+query.
 * Returns null when the value cannot be used for in-app navigation.
 */
export function sanitizeResumePath(
  raw: string | null | undefined,
  validate: (pathname: string) => boolean,
  opts?: { stripMemberCoachParams?: boolean },
): string | null {
  if (!raw?.trim()) return null;

  let candidate = raw.trim();

  try {
    if (/^https?:\/\//i.test(candidate)) {
      const absolute = new URL(candidate);
      candidate = `${absolute.pathname}${absolute.search}`;
    }
  } catch {
    return null;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate, "https://resume-path.invalid");
  } catch {
    return null;
  }

  const pathname = parsed.pathname.replace(/\/+$/, "") || parsed.pathname;
  if (!validate(pathname)) return null;

  const params = new URLSearchParams(parsed.search);
  if (opts?.stripMemberCoachParams) {
    for (const key of MEMBER_STRIP_PARAMS) params.delete(key);
  }

  const qs = params.toString();
  const rebuilt = qs ? `${pathname}?${qs}` : pathname;

  if (/[\s<>"']/.test(rebuilt)) return null;

  return rebuilt;
}

export function readStoredResumePath(
  key: string,
  validate: (pathname: string) => boolean,
  opts?: { stripMemberCoachParams?: boolean },
): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    const sanitized = sanitizeResumePath(raw, validate, opts);
    if (raw && !sanitized) {
      localStorage.removeItem(key);
    }
    return sanitized;
  } catch {
    return null;
  }
}

export function storeResumePath(key: string, fullPath: string, validate: (pathname: string) => boolean) {
  if (typeof window === "undefined") return;
  const sanitized = sanitizeResumePath(fullPath, validate, {
    stripMemberCoachParams: key === MEMBER_RESUME_KEY,
  });
  if (!sanitized) return;
  try {
    localStorage.setItem(key, sanitized);
  } catch {
    /* ignore quota / private mode */
  }
}

export function resolveMemberDashboardHref(): string {
  if (typeof window === "undefined") return defaultMemberResumePath();
  return (
    readStoredResumePath(MEMBER_RESUME_KEY, isSaveableMemberPath, {
      stripMemberCoachParams: true,
    }) ?? defaultMemberResumePath()
  );
}