import AdminApproachesPanel from "@/components/AdminApproachesPanel";

export const dynamic = "force-dynamic";

export default function AdminApproachesPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Approach</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          The line members read under each exercise. Standard sets, drop sets, and the rest start
          here. Add rows such as “Hold 2 count at bottom, 7 count up”, then pick that row on the
          workout.
        </p>
      </div>
      <AdminApproachesPanel />
    </div>
  );
}
