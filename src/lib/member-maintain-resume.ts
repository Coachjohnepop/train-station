/**
 * Client-side pointer to an in-progress Quick maintain session.
 * Live-session API restores sets/weights; this key + strip get you back to the console.
 * Works across navigations and soft refresh; private windows keep it until the window closes.
 */

export type MaintainResumePointer = {
  userId: string;
  workoutId: string;
  workoutName: string;
  sessionDate: string;
  /** ISO */
  updatedAt: string;
};

const STORAGE_KEY = "ts_maintain_resume_v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function maintainResumeHref(pointer: MaintainResumePointer): string {
  const q = new URLSearchParams();
  q.set("maintain", pointer.workoutId);
  if (pointer.sessionDate) q.set("date", pointer.sessionDate);
  return `/member/today?${q.toString()}`;
}

export function readMaintainResume(userId: string | null | undefined): MaintainResumePointer | null {
  if (!canUseStorage() || !userId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MaintainResumePointer;
    if (!parsed?.workoutId || parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function dismissKey(workoutId: string) {
  return `ts_maintain_resume_dismiss_${workoutId}`;
}

export function writeMaintainResume(pointer: MaintainResumePointer): void {
  if (!canUseStorage() || !pointer.userId || !pointer.workoutId) return;
  try {
    const next: MaintainResumePointer = {
      ...pointer,
      updatedAt: pointer.updatedAt || new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    try {
      sessionStorage.removeItem(dismissKey(pointer.workoutId));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("maintain-resume-changed", { detail: next }));
  } catch {
    /* private mode full / quota */
  }
}

export function isMaintainResumeDismissed(workoutId: string): boolean {
  if (!canUseStorage()) return false;
  try {
    return sessionStorage.getItem(dismissKey(workoutId)) === "1";
  } catch {
    return false;
  }
}

/** Hide strip for this tab until they re-open the workout (resume pointer still stored). */
export function dismissMaintainResumeStrip(workoutId: string): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(dismissKey(workoutId), "1");
    window.dispatchEvent(new CustomEvent("maintain-resume-changed", { detail: "dismiss" }));
  } catch {
    /* ignore */
  }
}

export function clearMaintainResume(
  userId: string | null | undefined,
  workoutId?: string | null,
): void {
  if (!canUseStorage() || !userId) return;
  try {
    const cur = readMaintainResume(userId);
    if (!cur) return;
    if (workoutId && cur.workoutId !== workoutId) return;
    localStorage.removeItem(STORAGE_KEY);
    if (cur.workoutId) {
      try {
        sessionStorage.removeItem(dismissKey(cur.workoutId));
      } catch {
        /* ignore */
      }
    }
    window.dispatchEvent(new CustomEvent("maintain-resume-changed", { detail: null }));
  } catch {
    /* ignore */
  }
}

/** True when current URL is already on this maintain session. */
export function isOnMaintainResumePath(
  pointer: MaintainResumePointer,
  pathname: string,
  search: string,
): boolean {
  if (!pathname.includes("/member/today")) return false;
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return q.get("maintain") === pointer.workoutId;
}
