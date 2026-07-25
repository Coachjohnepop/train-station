"use client";

/**
 * Sticky “Back to workout” bar for in-progress Quick maintain — same idea as Zoom join.
 * Visible on any member page until they rejoin or finish/log the session.
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
    if (local) setResume(local);

    try {
      const res = await fetch(
        `/api/member/maintain-resume?userId=${encodeURIComponent(memberUserId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { resume?: MaintainResumePointer | null };
      if (data.resume?.workoutId) {
        writeMaintainResume(data.resume);
        setResume(data.resume);
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
      setResume(readMaintainResume(memberUserId));
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("maintain-resume-changed", onChange);
    window.addEventListener("storage", onChange);
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => {
      window.removeEventListener("maintain-resume-changed", onChange);
      window.removeEventListener("storage", onChange);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, [memberUserId, refresh]);

  if (!resume || !memberUserId) return null;

  const onSession = isOnMaintainResumePath(resume, pathname, search);
  if (onSession) return null;
  if (isMaintainResumeDismissed(resume.workoutId)) return null;

  const href = maintainResumeHref(resume);

  return (
    <div
      className={`border-b border-violet-500/35 bg-violet-950/95 backdrop-blur-sm ${
        embedded ? "" : "sticky top-0 z-40"
      }`}
    >
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 px-4 py-2 md:max-w-3xl lg:max-w-6xl xl:max-w-7xl md:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
            Quick maintain · in progress
          </p>
          <p className="truncate text-xs text-violet-100/85">{resume.workoutName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="btn-ghost border border-violet-400/30 px-2 py-2 text-[10px] font-semibold text-violet-200/80"
            title="Hide this bar until you open the workout again"
            onClick={() => {
              dismissMaintainResumeStrip(resume.workoutId);
              setResume(null);
            }}
          >
            Dismiss
          </button>
          <Link
            href={href}
            className="btn-primary shrink-0 px-3 py-2 text-xs font-bold sm:px-4 sm:text-sm"
          >
            Back to workout
          </Link>
        </div>
      </div>
    </div>
  );
}
