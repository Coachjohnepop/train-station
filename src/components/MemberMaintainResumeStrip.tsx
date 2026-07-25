"use client";

/**
 * Smart top banner: in-progress Quick maintain — always above the fold until rejoin or finish.
 * Same sticky chrome as Live Class / Zoom; higher visual priority when a session is open.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  dismissMaintainResumeStrip,
  isMaintainResumeDismissed,
  isOnMaintainResumePath,
  maintainResumeHref,
  readMaintainResume,
  type MaintainResumePointer,
  writeMaintainResume,
} from "@/lib/member-maintain-resume";

type Props = {
  memberUserId: string | null;
  embedded?: boolean;
};

export default function MemberMaintainResumeStrip({
  memberUserId,
  embedded = false,
}: Props) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() || "";
  const [resume, setResume] = useState<MaintainResumePointer | null>(null);

  const refresh = useCallback(async () => {
    if (!memberUserId) {
      setResume(null);
      return;
    }
    const local = readMaintainResume(memberUserId);
    if (local && !isMaintainResumeDismissed(local.workoutId)) {
      setResume(local);
    }

    try {
      const res = await fetch(
        `/api/member/maintain-resume?userId=${encodeURIComponent(memberUserId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { resume?: MaintainResumePointer | null };
      if (data.resume?.workoutId) {
        writeMaintainResume(data.resume);
        if (!isMaintainResumeDismissed(data.resume.workoutId)) {
          setResume(data.resume);
        }
      } else if (!local) {
        setResume(null);
      }
    } catch {
      /* keep local */
    }
  }, [memberUserId]);

  useEffect(() => {
    void refresh();
    const onChange = () => {
      if (!memberUserId) return;
      const next = readMaintainResume(memberUserId);
      if (next && isMaintainResumeDismissed(next.workoutId)) {
        setResume(null);
        return;
      }
      setResume(next);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("maintain-resume-changed", onChange);
    window.addEventListener("storage", onChange);
    document.addEventListener("visibilitychange", onVis);
    // Re-check on SPA navigations (pathname/search change)
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => {
      window.removeEventListener("maintain-resume-changed", onChange);
      window.removeEventListener("storage", onChange);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, [memberUserId, refresh, pathname, search]);

  if (!resume || !memberUserId) return null;

  const onSession = isOnMaintainResumePath(resume, pathname, search);
  if (onSession) return null;
  if (isMaintainResumeDismissed(resume.workoutId)) return null;

  const href = maintainResumeHref(resume);

  return (
    <div
      role="banner"
      aria-label="Resume in-progress Quick maintain workout"
      className={`border-b border-amber-400/50 bg-gradient-to-r from-amber-600/95 via-amber-500/90 to-violet-600/90 shadow-[0_4px_24px_rgba(245,158,11,0.35)] ${
        embedded ? "" : "sticky top-0 z-[60]"
      }`}
    >
      <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-3 py-2.5 md:max-w-3xl lg:max-w-6xl xl:max-w-7xl md:px-6 lg:px-8 sm:px-4">
        <Link
          href={href}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none ring-offset-2 ring-offset-transparent focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <span
            className="hidden h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] sm:block"
            aria-hidden
          />
          <span className="min-w-0 text-left">
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/90">
              Workout in progress
            </span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-white sm:text-base">
              {resume.workoutName}
              <span className="font-normal text-white/85"> — pick up where you left off</span>
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            className="rounded-lg px-2 py-2 text-[10px] font-semibold text-white/80 hover:bg-black/15 hover:text-white sm:px-2.5"
            title="Hide this banner until you open the workout again"
            onClick={() => {
              dismissMaintainResumeStrip(resume.workoutId);
              setResume(null);
            }}
          >
            Dismiss
          </button>
          <Link
            href={href}
            className="rounded-full bg-white px-3 py-2 text-xs font-bold text-amber-900 shadow-md transition hover:bg-amber-50 sm:px-4 sm:text-sm"
          >
            Back to workout →
          </Link>
        </div>
      </div>
    </div>
  );
}
