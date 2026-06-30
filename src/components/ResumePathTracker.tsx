"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { storeResumePath } from "@/lib/resume-path";

export default function ResumePathTracker({
  storageKey,
  isSaveable,
}: {
  storageKey: string;
  isSaveable: (pathname: string) => boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    const full = qs ? `${pathname}?${qs}` : pathname;
    storeResumePath(storageKey, full, isSaveable);
  }, [storageKey, pathname, searchParams, isSaveable]);

  return null;
}