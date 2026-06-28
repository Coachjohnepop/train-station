import CoachSettingsPanel from "@/components/CoachSettingsPanel";

export default function AdminCoachSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coach settings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Alerts, warm-up template, and the 2-week new-member ramp plan.
        </p>
      </div>
      <CoachSettingsPanel />
    </div>
  );
}