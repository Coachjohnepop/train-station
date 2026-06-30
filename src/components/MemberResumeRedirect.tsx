"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MEMBER_RESUME_KEY,
  defaultMemberResumePath,
  readStoredResumePath,
  isSaveableMemberPath,
  sanitizeResumePath,
} from "@/lib/resume-path";

/** /member → last visited member page (e.g. mid-workout on Today). */
export default function MemberResumeRedirect() {
  const router = useRouter();

  useEffect(() => {
    const saved = readStoredResumePath(MEMBER_RESUME_KEY, isSaveableMemberPath, {
      stripMemberCoachParams: true,
    });
    const dest =
      saved ??
      sanitizeResumePath(defaultMemberResumePath(), isSaveableMemberPath) ??
      defaultMemberResumePath();

    try {
      router.replace(dest);
    } catch {
      window.location.assign(dest);
    }
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--muted)]">
      Opening where you left off…
    </div>
  );
}