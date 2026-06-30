"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  COACH_RESUME_KEY,
  defaultCoachResumePath,
  readStoredResumePath,
  isSaveableCoachPath,
} from "@/lib/resume-path";

const PREFER_DASHBOARD_KEY = "ts-admin-prefer-dashboard";

/** Mobile coaches: resume last admin page instead of always Queue. */
export default function CoachResumeRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mobile = window.matchMedia("(max-width: 1279px)").matches;
    if (!mobile) return;
    if (sessionStorage.getItem(PREFER_DASHBOARD_KEY) === "1") return;

    const saved = readStoredResumePath(COACH_RESUME_KEY, isSaveableCoachPath);
    const fallback = defaultCoachResumePath(true);
    const dest = saved && saved !== "/admin" ? saved : fallback;
    if (dest !== window.location.pathname + window.location.search) {
      router.replace(dest);
    }
  }, [router]);

  return null;
}