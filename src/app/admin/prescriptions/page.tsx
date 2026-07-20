import { redirect } from "next/navigation";
import PrescriptionExamplesReview from "@/components/PrescriptionExamplesReview";
import { getSessionUser } from "@/lib/auth";
import { canAccessPlatformAdmin, defaultCoachAdminPath } from "@/lib/staff-access";

/**
 * Super-admin / platform catalog tool — prescription pattern variables.
 * Hidden from coach Content nav; coaches use Programs → day builder instead.
 */
export default async function PrescriptionsAdminPage() {
  const session = await getSessionUser();
  if (!session || !canAccessPlatformAdmin(session.role)) {
    redirect(defaultCoachAdminPath());
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Prescription variables</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          Platform / super-admin only — reference patterns from{" "}
          <code className="rounded bg-[var(--surface-2)] px-1">workout-prescription-examples.csv</code>
          . Sets, holds, rest, and notes use the same structure as live workouts. Not shown in the
          coach Content nav.
        </p>
      </div>
      <PrescriptionExamplesReview />
    </div>
  );
}