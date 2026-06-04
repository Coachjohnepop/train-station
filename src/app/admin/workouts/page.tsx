import WorkoutList from "@/components/WorkoutList";

export default function WorkoutsAdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Workouts</h1>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">
        Name the workout, then add exercises from the library. For each
        movement you&apos;ll set approach, sets or timed duration, weight tier,
        and coaching notes — all in one cascade on the workout page.
      </p>
      <div className="mt-8">
        <WorkoutList />
      </div>
    </div>
  );
}