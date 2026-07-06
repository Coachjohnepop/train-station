import WorkoutDayBrowser from "@/components/WorkoutDayBrowser";

export default function WorkoutsAdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Workouts</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        Build and manage 28-day workout cycles — the center of every program. Pick M1D1–M1D28 on
        the left, assign Gym/Home workouts per day, copy a finished cycle to the next month, or
        deploy a library cycle into any program.
      </p>
      <div className="mt-6">
        <WorkoutDayBrowser />
      </div>
    </div>
  );
}