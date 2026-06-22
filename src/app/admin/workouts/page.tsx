import WorkoutList from "@/components/WorkoutList";

export default function WorkoutsAdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Workouts</h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
        Create a workout, add movements from your library, and set reps, sets, and weight tier on one screen.
      </p>
      <div className="mt-6">
        <WorkoutList />
      </div>
    </div>
  );
}