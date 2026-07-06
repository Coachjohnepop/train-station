#!/usr/bin/env node
/**
 * Best-guess 28-day cycle fill for a new program month (beginner-friendly split).
 *
 * Usage:
 *   npx tsx scripts/populate-cycle-month.mjs adult 2
 *   DRY_RUN=1 npx tsx scripts/populate-cycle-month.mjs adult 2
 */

import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";
import { workoutContentTitleKey } from "../src/lib/workout-content-name.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const WEEK_A = [
  { gym: "Upper Body Workout", home: "Upper Body" },
  { gym: "Fasted Cardio", home: "Fasted Cardio" },
  { gym: "Lower Body Workout", home: "Leg Day" },
  { rest: true, notes: "Rest day" },
  { gym: "Split Routine Chest/Shoulders/Triceps", home: "Split Routine Chest/Shoulders/Triceps" },
  { gym: "Back/Bicep", home: "Back/Bicep" },
  { rest: true, notes: "Rest day" },
];

const WEEK_B = [
  { gym: "Upper Body Workout", home: "Upper Body Workout" },
  { gym: "Fasted Cardio", home: "Fasted Cardio" },
  { gym: "Lower Body", home: "Lower Day" },
  { gym: "Active Recovery Rest Day", home: "Active Recovery Rest Day" },
  { gym: "Shoulder/Tricep/Ab/Calves", home: "Shoulder/Tricep/Ab/Calves" },
  { gym: "Leg Day", home: "Leg Day" },
  { rest: true, notes: "Rest day" },
];

function buildMonthPlan() {
  return [WEEK_A, WEEK_B, WEEK_A, WEEK_B].flat();
}

async function resolveWorkoutIds(prisma) {
  const workouts = await prisma.workout.findMany({ select: { id: true, name: true } });
  const byKey = new Map();
  for (const w of workouts) {
    const key = workoutContentTitleKey(w.name);
    if (!byKey.has(key)) byKey.set(key, w.id);
  }
  return byKey;
}

async function main() {
  const programSlug = process.argv[2] || "adult";
  const cycleMonth = Number(process.argv[3] || "2");
  if (!Number.isFinite(cycleMonth) || cycleMonth < 1 || cycleMonth > 12) {
    console.error("cycleMonth must be 1–12");
    process.exit(1);
  }

  const pool = createPgPool(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const program = await prisma.program.findUnique({
    where: { slug: programSlug },
    select: { id: true, name: true },
  });
  if (!program) {
    console.error(`Program not found: ${programSlug}`);
    process.exit(1);
  }

  let cycle = await prisma.workoutCycle.findUnique({
    where: { programId_cycleMonth: { programId: program.id, cycleMonth } },
  });
  if (!cycle) {
    if (DRY_RUN) {
      console.log(`Would create cycle ${program.name} · M${cycleMonth}`);
      await prisma.$disconnect();
      await pool.end();
      return;
    }
    cycle = await prisma.workoutCycle.create({
      data: {
        name: `${program.name} · M${cycleMonth}`,
        programId: program.id,
        cycleMonth,
      },
    });
    console.log(`Created cycle ${cycle.name} (${cycle.id})`);
  }

  const { ensureCycleDays, syncCycleToProgramSchedule } = await import(
    "../src/lib/workout-cycle-db.ts"
  );
  await ensureCycleDays(cycle.id);

  const workoutIds = await resolveWorkoutIds(prisma);
  const plan = buildMonthPlan();
  const missing = new Set();

  console.log(
    `${DRY_RUN ? "[DRY RUN] " : ""}Populating ${program.name} M${cycleMonth} (${cycle.id}) — beginner 4-week split\n`,
  );

  const cycleDays = await prisma.workoutCycleDay.findMany({
    where: { cycleId: cycle.id },
    orderBy: { dayNumber: "asc" },
  });
  const dayByNumber = new Map(cycleDays.map((d) => [d.dayNumber, d]));

  for (let dayNumber = 1; dayNumber <= 28; dayNumber++) {
    const spec = plan[dayNumber - 1];
    const cycleDay = dayByNumber.get(dayNumber);
    if (!cycleDay) continue;

    if (spec.rest) {
      console.log(`M${cycleMonth}D${dayNumber}: rest — ${spec.notes}`);
      if (DRY_RUN) continue;
      await prisma.workoutCycleDaySlot.deleteMany({ where: { cycleDayId: cycleDay.id } });
      await prisma.workoutCycleDay.update({
        where: { id: cycleDay.id },
        data: { isDayOff: true, notes: spec.notes },
      });
      continue;
    }

    const gymId = workoutIds.get(workoutContentTitleKey(spec.gym));
    const homeId = workoutIds.get(workoutContentTitleKey(spec.home));
    if (!gymId) missing.add(spec.gym);
    if (!homeId) missing.add(spec.home);

    console.log(
      `M${cycleMonth}D${dayNumber}: gym=${spec.gym}${gymId ? "" : " (MISSING)"} · home=${spec.home}${homeId ? "" : " (MISSING)"}`,
    );

    if (DRY_RUN || !gymId || !homeId) continue;

    await prisma.workoutCycleDaySlot.deleteMany({ where: { cycleDayId: cycleDay.id } });
    await prisma.workoutCycleDay.update({
      where: { id: cycleDay.id },
      data: { isDayOff: false, notes: null },
    });
    await prisma.workoutCycleDaySlot.createMany({
      data: [
        { cycleDayId: cycleDay.id, workoutId: gymId, trainingLocation: "gym", sortOrder: 0 },
        { cycleDayId: cycleDay.id, workoutId: homeId, trainingLocation: "home", sortOrder: 1 },
      ],
    });
  }

  if (missing.size) {
    console.error("\nMissing workouts in library:", [...missing].join(", "));
    process.exit(1);
  }

  if (!DRY_RUN) {
    await syncCycleToProgramSchedule(cycle.id);
    const filled = await prisma.workoutCycleDay.count({
      where: {
        cycleId: cycle.id,
        OR: [{ isDayOff: true }, { slots: { some: {} } }],
      },
    });
    console.log(`\nDone — ${filled}/28 days filled on M${cycleMonth}.`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});