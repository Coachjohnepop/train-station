#!/usr/bin/env npx tsx
/**
 * Merge duplicate exercises into canonical simple names.
 * Reps/sets embedded in legacy Exercise.name move to WorkoutExercise.
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/standardize-exercise-catalog.ts
 *   npx tsx scripts/standardize-exercise-catalog.ts
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.production", override: true });

import {
  canonicalExerciseName,
  extractPrescriptionFromExerciseName,
  isJunkExerciseName,
  mergePrescriptionNotes,
  normalizeExerciseKey,
} from "../src/lib/exercise-canonical";

const DRY_RUN = process.env.DRY_RUN === "1";

function resolveConnectionString(): string {
  const direct = process.env.POSTGRES_URL_NON_POOLING ?? "";
  const pooled =
    process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? "";
  const database = process.env.DATABASE_URL ?? "";
  return (
    direct ||
    (database && !database.includes("dummy") ? database : "") ||
    pooled
  );
}

type ExerciseRow = {
  id: string;
  name: string;
  videoUrl: string | null;
  tags: string | null;
  createdAt: Date;
};

function keeperScore(ex: ExerciseRow, canonical: string): number {
  let score = 0;
  if (ex.name === canonical) score += 100;
  if (!/\d{1,3}(?:,\d{1,3})+/.test(ex.name) && !/\s\d{1,3}\s*$/.test(ex.name)) {
    score += 40;
  }
  if (ex.videoUrl) score += 20;
  if (ex.id.startsWith("cmp")) score += 10;
  if (ex.tags && !ex.tags.includes("qa")) score += 5;
  score -= ex.name.length * 0.05;
  return score;
}

function pickKeeper(group: Array<ExerciseRow & { canonical: string }>) {
  return [...group].sort(
    (a, b) => keeperScore(b, b.canonical) - keeperScore(a, b.canonical),
  )[0];
}

type WorkoutExercisePatch = {
  exerciseId?: string;
  sets?: number | null;
  reps?: string | null;
  notes?: string | null;
};

/** Raw SQL patch — prod may not have setCount/restBetweenSetsSec columns yet. */
async function patchWorkoutExercise(
  prisma: { $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number> },
  id: string,
  patch: WorkoutExercisePatch,
) {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (patch.exerciseId !== undefined) {
    sets.push(`"exerciseId" = $${idx++}`);
    values.push(patch.exerciseId);
  }
  if (patch.sets !== undefined) {
    sets.push(`"sets" = $${idx++}`);
    values.push(patch.sets);
  }
  if (patch.reps !== undefined) {
    sets.push(`"reps" = $${idx++}`);
    values.push(patch.reps);
  }
  if (patch.notes !== undefined) {
    sets.push(`"notes" = $${idx++}`);
    values.push(patch.notes);
  }

  if (sets.length === 0) return;

  values.push(id);
  await prisma.$executeRawUnsafe(
    `UPDATE "WorkoutExercise" SET ${sets.join(", ")} WHERE id = $${idx}`,
    ...values,
  );
}

async function main() {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    console.error("No Postgres URL — set POSTGRES_PRISMA_URL in .env.vercel.production");
    process.exit(1);
  }

  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { createPgPool } = await import("../src/lib/pg-connection");

  const adapter = new PrismaPg(createPgPool(connectionString));
  const prisma = new PrismaClient({ adapter });

  const exercises = await prisma.exercise.findMany({
    select: {
      id: true,
      name: true,
      videoUrl: true,
      tags: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  const workoutItems = await prisma.workoutExercise.findMany({
    select: {
      id: true,
      exerciseId: true,
      sets: true,
      reps: true,
      notes: true,
    },
  });

  const itemsByExercise = new Map<string, typeof workoutItems>();
  for (const item of workoutItems) {
    if (!itemsByExercise.has(item.exerciseId)) {
      itemsByExercise.set(item.exerciseId, []);
    }
    itemsByExercise.get(item.exerciseId)!.push(item);
  }

  const enriched = exercises.map((ex) => ({
    ...ex,
    canonical: canonicalExerciseName(ex.name),
    key: normalizeExerciseKey(canonicalExerciseName(ex.name)),
    junk: isJunkExerciseName(ex.name),
  }));

  const groups = new Map<string, typeof enriched>();
  for (const ex of enriched) {
    if (!groups.has(ex.key)) groups.set(ex.key, []);
    groups.get(ex.key)!.push(ex);
  }

  let renamed = 0;
  let relinked = 0;
  let deleted = 0;
  let junkDeleted = 0;
  const plan: string[] = [];

  for (const [key, group] of groups) {
    if (group.every((g) => g.junk)) {
      const fallbackCanonical = group[0]?.canonical || "General Warm Up + Shoulder Mobility";
      const refsTotal = group.flatMap((junk) => itemsByExercise.get(junk.id) ?? []);

      if (refsTotal.length === 0) {
        for (const junk of group) {
          plan.push(`DELETE junk: ${junk.name}`);
          if (!DRY_RUN) {
            await prisma.exercise.delete({ where: { id: junk.id } });
            junkDeleted += 1;
          }
        }
        continue;
      }

      let fallback =
        exercises.find((e) => e.name === fallbackCanonical) ?? null;
      if (!fallback && !DRY_RUN) {
        fallback = await prisma.exercise.create({
          data: { name: fallbackCanonical, tags: "catalog-merge" },
          select: {
            id: true,
            name: true,
            videoUrl: true,
            tags: true,
            createdAt: true,
          },
        });
        exercises.push(fallback);
      } else if (!fallback) {
        plan.push(`CREATE fallback for junk group: ${fallbackCanonical}`);
      }

      for (const junk of group) {
        const refs = itemsByExercise.get(junk.id) ?? [];
        if (refs.length > 0 && fallback) {
          plan.push(
            `MERGE junk "${junk.name}" → "${fallbackCanonical}" (${refs.length} items)`,
          );
          for (const item of refs) {
            if (!DRY_RUN) {
              await patchWorkoutExercise(prisma, item.id, {
                exerciseId: fallback.id,
              });
            }
            relinked += 1;
          }
        }
        plan.push(`DELETE junk: ${junk.name}`);
        if (!DRY_RUN) {
          await prisma.exercise.delete({ where: { id: junk.id } });
          junkDeleted += 1;
        }
      }
      continue;
    }

    const active = group.filter((g) => !g.junk);
    if (active.length === 0) continue;

    let keeper = pickKeeper(active);
    let canonical = keeper.canonical;

    if (keeper.name !== canonical) {
      plan.push(`RENAME keeper: "${keeper.name}" → "${canonical}"`);
      if (!DRY_RUN) {
        await prisma.exercise.update({
          where: { id: keeper.id },
          data: { name: canonical },
        });
        renamed += 1;
      }
    }

    for (const dup of active) {
      if (dup.id === keeper.id) continue;

      const refs = itemsByExercise.get(dup.id) ?? [];
      const rx = extractPrescriptionFromExerciseName(dup.name);
      plan.push(
        `MERGE "${dup.name}" → "${canonical}" (${refs.length} items)`,
      );

      for (const item of refs) {
        const patch = {
          exerciseId: keeper.id,
          sets: item.sets ?? rx.sets ?? null,
          reps: item.reps && item.reps !== "—" ? item.reps : rx.reps ?? null,
          notes: mergePrescriptionNotes(
            item.notes,
            rx.notes,
            dup.name !== canonical ? `From: ${dup.name}` : null,
          ),
        };

        if (!DRY_RUN) {
          await patchWorkoutExercise(prisma, item.id, patch);
        }
        relinked += 1;
      }

      if (!DRY_RUN) {
        await prisma.exercisePerformance.updateMany({
          where: { exerciseId: dup.id },
          data: { exerciseId: keeper.id },
        });
        await prisma.exercise.delete({ where: { id: dup.id } });
      }
      deleted += 1;
    }

    for (const junk of group.filter((g) => g.junk)) {
      const refs = itemsByExercise.get(junk.id) ?? [];
      if (refs.length === 0) {
        plan.push(`DELETE junk: ${junk.name}`);
        if (!DRY_RUN) {
          await prisma.exercise.delete({ where: { id: junk.id } });
          junkDeleted += 1;
        }
        continue;
      }
      plan.push(
        `MERGE junk "${junk.name}" → "${canonical}" (${refs.length} items)`,
      );
      for (const item of refs) {
        if (!DRY_RUN) {
          await patchWorkoutExercise(prisma, item.id, { exerciseId: keeper.id });
        }
        relinked += 1;
      }
      if (!DRY_RUN) {
        await prisma.exercise.delete({ where: { id: junk.id } });
        junkDeleted += 1;
      }
    }
  }

  const afterCount = DRY_RUN
    ? exercises.length - deleted - junkDeleted
    : await prisma.exercise.count();

  console.log(`\nStandardize exercise catalog ${DRY_RUN ? "(DRY RUN)" : ""}\n`);
  for (const line of plan) console.log(`  ${line}`);
  console.log(`\nSummary:`);
  console.log(`  Before: ${exercises.length} exercises`);
  console.log(`  Renamed keepers: ${renamed}`);
  console.log(`  Workout items relinked/patched: ${relinked}`);
  console.log(`  Duplicates deleted: ${deleted}`);
  console.log(`  Junk deleted: ${junkDeleted}`);
  console.log(`  After: ${afterCount} exercises\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});