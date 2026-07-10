import { prisma } from "@/lib/prisma";

/** Remove an exercise from the catalog and all workouts that reference it. */
export async function deleteCatalogExercise(exerciseId: string): Promise<{
  removedFromWorkouts: number;
}> {
  return prisma.$transaction(async (tx) => {
    const exercise = await tx.exercise.findUnique({
      where: { id: exerciseId },
      select: { id: true },
    });
    if (!exercise) {
      throw new Error("NOT_FOUND");
    }

    const refs = await tx.workoutExercise.findMany({
      where: { exerciseId },
      select: { id: true, workoutId: true },
      orderBy: [{ workoutId: "asc" }, { sortOrder: "asc" }],
    });

    if (refs.length) {
      await tx.workoutExercise.deleteMany({ where: { exerciseId } });

      const byWorkout = new Map<string, string[]>();
      for (const ref of refs) {
        const list = byWorkout.get(ref.workoutId) ?? [];
        list.push(ref.id);
        byWorkout.set(ref.workoutId, list);
      }

      for (const [workoutId] of byWorkout) {
        const remaining = await tx.workoutExercise.findMany({
          where: { workoutId },
          orderBy: { sortOrder: "asc" },
          select: { id: true },
        });
        await Promise.all(
          remaining.map((row, idx) =>
            tx.workoutExercise.update({
              where: { id: row.id },
              data: { sortOrder: idx },
            }),
          ),
        );
        await tx.workout.update({
          where: { id: workoutId },
          data: { updatedAt: new Date() },
        });
      }
    }

    await tx.exercise.delete({ where: { id: exerciseId } });
    return { removedFromWorkouts: refs.length };
  });
}