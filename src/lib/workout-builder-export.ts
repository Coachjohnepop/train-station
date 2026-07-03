import type { ParsedSmsExercise, ParsedSmsWorkout } from "@/lib/sms-workout-parser";

export type WorkoutItemForExport = {
  setScheme: string | null;
  repPattern: string | null;
  reps: string | null;
  sets: number | null;
  notes: string | null;
  exercise: { name: string };
};

export function workoutItemsToParsedSms(workout: {
  name: string;
  exercises: WorkoutItemForExport[];
}): ParsedSmsWorkout {
  const exercises: ParsedSmsExercise[] = workout.exercises.map((item) => {
    const name = item.exercise.name;
    const isWarm = /warm/i.test(name);
    const isCooldown = /stretch|cool\s*down/i.test(name) || /^stretch$/i.test(name);

    const setScheme = item.setScheme === "timed" ? ("timed" as const) : ("standard" as const);
    const sets = item.sets && item.sets > 0 ? item.sets : 1;
    const reps = item.reps?.trim() || "—";

    const noteParts: string[] = [];
    if (item.notes?.trim()) noteParts.push(item.notes.trim());
    if (item.repPattern?.trim()) noteParts.push(item.repPattern.trim());

    return {
      name,
      sets,
      reps,
      notes: noteParts.length > 0 ? noteParts.join(" · ") : undefined,
      setScheme,
      section: isWarm ? "warmup" : isCooldown ? "cooldown" : "main",
    };
  });

  return {
    title: workout.name,
    exercises,
    rawText: "",
  };
}