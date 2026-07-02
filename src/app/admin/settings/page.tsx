import { Suspense } from "react";
import CoachSettingsPanel from "@/components/CoachSettingsPanel";
import ZoomConnectPanel from "@/components/ZoomConnectPanel";

export default function AdminCoachSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coach settings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Alerts, warm-up template, Zoom live rooms, and the 2-week new-member ramp plan.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading Zoom…</p>}>
        <ZoomConnectPanel />
      </Suspense>
      <CoachSettingsPanel />
    </div>
  );
}