import { prisma } from "@/lib/prisma";
import {
  ADULT_WEEK_ACTIVE_RECOVERY_ID,
  ADULT_WEEK_FASTED_CARDIO_ID,
  ADULT_WEEK_FLOW,
  ADULT_WEEK_REST_MEAL_PREP_ID,
} from "@/lib/adult-week-flow";

type FlowLine = {
  exerciseName: string;
  sets: number;
  reps: string;
  setScheme: string;
  notes: string;
};

const FASTED_CARDIO_LINES: FlowLine[] = [
  {
    exerciseName: "General Warm Up + Shoulder Mobility",
    sets: 1,
    reps: "5-7 min",
    setScheme: "timed",
    notes: "5-7 min easy cardio + band mobility.",
  },
  {
    exerciseName: "Fasted Cardio",
    sets: 1,
    reps: "35 min",
    setScheme: "timed",
    notes:
      "Walk on a treadmill (or outside) 35 minutes briskly. Keep heart rate under 140 and above 100 if you can. Stretch extra well after.",
  },
];

const ACTIVE_RECOVERY_LINES: FlowLine[] = [
  {
    exerciseName: "Bicycle or Walk",
    sets: 1,
    reps: "20 min",
    setScheme: "timed",
    notes: "Easy pace. This is recovery, not a workout.",
  },
  {
    exerciseName: "Cool Down & Stretch",
    sets: 1,
    reps: "10 min",
    setScheme: "timed",
    notes: "Move through hips, hamstrings, chest, and shoulders.",
  },
  {
    exerciseName: "Rest & Active Recovery",
    sets: 1,
    reps: "10 min",
    setScheme: "timed",
    notes: "Light activity and stretching. Stay loose.",
  },
];

const REST_MEAL_PREP_LINES: FlowLine[] = [
  {
    exerciseName: "Rest & Active Recovery",
    sets: 1,
    reps: "rest",
    setScheme: "timed",
    notes: "Off from lifting. Walk if you feel like it.",
  },
  {
    exerciseName: "Meal Prep",
    sets: 1,
    reps: "week",
    setScheme: "timed",
    notes:
      "Meal prep for your macros for the week. A well thought out week insures getting results. You can do this!!",
  },
];

const CANONICAL: Array<{
  id: string;
  name: string;
  description: string;
  lines: FlowLine[];
}> = [
  {
    id: ADULT_WEEK_FASTED_CARDIO_ID,
    name: "Fasted Cardio",
    description: "Day 3 — 35 minutes fasted cardio, heart rate under 140.",
    lines: FASTED_CARDIO_LINES,
  },
  {
    id: ADULT_WEEK_ACTIVE_RECOVERY_ID,
    name: "Active Recovery Stretch",
    description: "Day 6 — easy movement plus a full stretch.",
    lines: ACTIVE_RECOVERY_LINES,
  },
  {
    id: ADULT_WEEK_REST_MEAL_PREP_ID,
    name: "Rest and Meal Prep",
    description: "Day 7 — rest day and plan meals for the week.",
    lines: REST_MEAL_PREP_LINES,
  },
];

async function findExerciseId(name: string): Promise<string | null> {
  const row = await prisma.exercise.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      archivedAt: null,
    },
    select: { id: true },
  });
  if (row) return row.id;
  const created = await prisma.exercise.create({
    data: { name, tags: "adult-week-flow" },
    select: { id: true },
  });
  return created.id;
}

async function ensureCanonicalWorkout(spec: (typeof CANONICAL)[number]) {
  const existing = await prisma.workout.findUnique({
    where: { id: spec.id },
    select: { id: true, _count: { select: { exercises: true } } },
  });
  if (!existing) {
    await prisma.workout.create({
      data: {
        id: spec.id,
        name: spec.name,
        description: spec.description,
        source: "catalog",
      },
    });
  } else {
    await prisma.workout.update({
      where: { id: spec.id },
      data: { name: spec.name, description: spec.description },
    });
  }

  const lineCount = existing?._count.exercises ?? 0;
  if (lineCount > 0) return spec.id;

  const rows: Array<{
    exerciseId: string;
    sortOrder: number;
    sets: number;
    reps: string;
    setScheme: string;
    notes: string;
  }> = [];
  for (let i = 0; i < spec.lines.length; i++) {
    const line = spec.lines[i];
    const exerciseId = await findExerciseId(line.exerciseName);
    if (!exerciseId) continue;
    rows.push({
      exerciseId,
      sortOrder: i,
      sets: line.sets,
      reps: line.reps,
      setScheme: line.setScheme,
      notes: line.notes,
    });
  }
  if (rows.length) {
    await prisma.workoutExercise.createMany({ data: rows.map((r) => ({ ...r, workoutId: spec.id })) });
  }
  return spec.id;
}

async function assignDayWorkout(dayId: string, workoutId: string) {
  await prisma.programDay.update({
    where: { id: dayId },
    data: { workoutId },
  });
  const options = await prisma.programDayOption.findMany({
    where: { dayId },
    orderBy: { sortOrder: "asc" },
  });
  if (!options.length) {
    await prisma.programDayOption.createMany({
      data: [
        { dayId, workoutId, label: "Gym", trainingLocation: "gym", sortOrder: 0 },
        { dayId, workoutId, label: "Home", trainingLocation: "home", sortOrder: 1 },
      ],
    });
    return;
  }
  for (const opt of options) {
    await prisma.programDayOption.update({
      where: { id: opt.id },
      data: { workoutId },
    });
  }
}

export async function ensureAdultWeekFlow(opts?: { weeks?: number[] }): Promise<{
  workouts: string[];
  daysUpdated: number;
}> {
  const weeks = opts?.weeks ?? [1, 2];
  const workoutIds: string[] = [];
  for (const spec of CANONICAL) {
    workoutIds.push(await ensureCanonicalWorkout(spec));
  }

  const program = await prisma.program.findUnique({
    where: { slug: "adult" },
    select: { id: true },
  });
  if (!program) return { workouts: workoutIds, daysUpdated: 0 };

  const programWeeks = await prisma.programWeek.findMany({
    where: { programId: program.id, weekNumber: { in: weeks } },
    select: { id: true, weekNumber: true },
  });
  const days = await prisma.programDay.findMany({
    where: { weekId: { in: programWeeks.map((w) => w.id) } },
    select: { id: true, dayNumber: true, weekId: true },
  });

  let daysUpdated = 0;
  for (const day of days) {
    const flow = ADULT_WEEK_FLOW.find((d) => d.dayNumber === day.dayNumber);
    if (!flow?.workoutId) continue;
    await assignDayWorkout(day.id, flow.workoutId);
    daysUpdated += 1;
  }

  return { workouts: workoutIds, daysUpdated };
}
