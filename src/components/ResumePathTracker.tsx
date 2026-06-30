"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  COACH_RESUME_KEY,
  MEMBER_RESUME_KEY,
  isSaveableCoachPath,
  isSaveableMemberPath,
  storeResumePath,
} from "@/lib/resume-path";

/** Track last URL for resume — validators stay client-side (no function props from RSC). */
export default function ResumePathTracker({ area }: { area: "member" | "coach" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storageKey = area === "member" ? MEMBER_RESUME_KEY : COACH_RESUME_KEY;
  const isSaveable = area === "member" ? isSaveableMemberPath : isSaveableCoachPath;

  useEffect(() => {
    const qs = searchParams.toString();
    const full = qs ? `${pathname}?${qs}` : pathname;
    storeResumePath(storageKey, full, isSaveable);
  }, [storageKey, pathname, searchParams, isSaveable]);

  return null;
}