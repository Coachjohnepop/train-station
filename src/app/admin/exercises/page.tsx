import ExerciseHowTo from "@/components/ExerciseHowTo";
import ExerciseLibrary from "@/components/ExerciseLibrary";

export default function ExercisesAdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Exercise library</h1>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">
        A simple catalog of movement names and demo videos. Program each
        exercise when you add it to a workout.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <ExerciseHowTo />
        <ExerciseLibrary />
      </div>
    </div>
  );
}