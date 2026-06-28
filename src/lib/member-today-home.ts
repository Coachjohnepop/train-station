import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export const MEMBER_TODAY_RESET_EVENT = "member-today-reset";

/** True when URL is the bare member Today dashboard (no date or other query). */
export function isMemberTodayHomeLocation(pathname: string, search: string): boolean {
  if (pathname !== "/member/today") return false;
  const params = new URLSearchParams(search);
  return params.toString() === "";
}

/** Navigate to Today and reset day selection — works even when already on Today. */
export function goMemberTodayHome(router: AppRouterInstance): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MEMBER_TODAY_RESET_EVENT));
  }

  if (typeof window === "undefined") {
    router.push("/member/today");
    return;
  }

  const { pathname, search } = window.location;
  if (isMemberTodayHomeLocation(pathname, search)) {
    router.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  router.push("/member/today");
}