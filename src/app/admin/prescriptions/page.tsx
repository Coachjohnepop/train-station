import PrescriptionExamplesReview from "@/components/PrescriptionExamplesReview";

export default function PrescriptionsAdminPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Workout prescriptions</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          Reference patterns from{" "}
          <code className="rounded bg-[var(--surface-2)] px-1">workout-prescription-examples.csv</code>
          . Jeremy can edit any row — sets, holds, rest, and notes use the same structure as live
          workouts. Need another view later? Add a column to the right.
        </p>
      </div>
      <PrescriptionExamplesReview />
    </div>
  );
}