import Link from "next/link";
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

      <div className="rounded-xl border border-violet-500/35 bg-violet-500/10 px-4 py-3 text-sm">
        <p className="font-semibold text-violet-100">Site videos</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Free gag (~10s), intros, thank-you after purchase, weekly / dinner / daily inspiration —
          all managed in one desk.
        </p>
        <Link
          href="/admin/videos"
          className="mt-2 inline-flex text-sm font-semibold text-accent hover:underline"
        >
          Open Video admin →
        </Link>
      </div>

      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading Zoom…</p>}>
        <ZoomConnectPanel />
      </Suspense>
      <CoachSettingsPanel />
    </div>
  );
}