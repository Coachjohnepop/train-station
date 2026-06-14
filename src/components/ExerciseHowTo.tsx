export default function ExerciseHowTo() {
  return (
    <aside className="card card-accent-frame bg-accent-muted">
      <h2 className="text-lg font-semibold text-accent">
        Exercise library
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Each movement has a name, optional description, and optional demo
        video. Reuse the same exercise in any workout.
      </p>

      <ol className="mt-4 space-y-4 text-sm">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-bold text-accent">
            1
          </span>
          <div>
            <p className="font-medium">Name the movement</p>
            <p className="mt-1 text-[var(--muted)]">
              e.g. <em>Back Squat</em> — required.
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-bold text-accent">
            2
          </span>
          <div>
            <p className="font-medium">Description (optional)</p>
            <p className="mt-1 text-[var(--muted)]">
              A short summary members can read in the library context.
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-bold text-accent">
            3
          </span>
          <div>
            <p className="font-medium">Add a demo video (optional)</p>
            <p className="mt-1 text-[var(--muted)]">
              YouTube or other link — members can watch without leaving the
              workout.
            </p>
          </div>
        </li>
      </ol>

      <p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
        <strong className="text-[var(--text)]">Programming lives in workouts:</strong>{" "}
        set approach, sets or timed duration, weight tier, and coaching notes
        are set under{" "}
        <strong className="text-[var(--text)]">Admin → Workouts</strong> when you
        add each exercise.
      </p>

      <p className="mt-3 text-xs text-[var(--muted)]">
        The library table now shows where each exercise is scheduled (programs + specific days).
        Click “View details” on any row for the full breakdown and direct links.
      </p>
    </aside>
  );
}