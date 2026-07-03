"use client";

import { Suspense } from "react";
import AnalyticsTracker from "@/components/AnalyticsTracker";

export default function AnalyticsTrackerRoot() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTracker />
    </Suspense>
  );
}