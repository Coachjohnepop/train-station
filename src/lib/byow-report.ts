import "server-only";

import { prisma } from "@/lib/prisma";

const TZ = "America/Los_Angeles";

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "triceps",
  "legs",
  "stomach",
  "calves",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: "chest",
  back: "back",
  shoulders: "shoulders",
  arms: "arms",
  triceps: "triceps",
  legs: "legs",
  stomach: "stomach",
  calves: "calves",
};

const MATCHERS: Array<{ group: MuscleGroup; re: RegExp }> = [
  { group: "calves", re: /\bcalf|\bcalves\b/i },
  { group: "stomach", re: /\babs?\b|\bcore\b|stomach|crunch|plank|sit.?up|bicycle/i },
  { group: "triceps", re: /tricep|kickback|skull.?crusher|overhead extension/i },
  { group: "chest", re: /\bchest\b|\bpec|\bbench\b|push.?up|chest fly/i },
  { group: "back", re: /\bback\b|\brows?\b|lat |pull.?down|pull.?up|deadlift/i },
  { group: "shoulders", re: /shoulder|delt|overhead press|lateral raise/i },
  { group: "legs", re: /\bleg\b|squat|lunge|quad|hamstring|rdl|hip thrust|glute/i },
  { group: "arms", re: /bicep|\bcurl\b|arm /i },
];

export function musclesFromNames(names: string[]): MuscleGroup[] {
  const hit = new Set<MuscleGroup>();
  for (const name of names) {
    for (const { group, re } of MATCHERS) {
      if (re.test(name)) hit.add(group);
    }
  }
  return MUSCLE_GROUPS.filter((g) => hit.has(g));
}

export function isCardioName(name: string): boolean {
  return /cardio|fasted|hiit|bike|run|jog|row machine|treadmill/i.test(name);
}

function weekStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  const d = new Date(`${map.year}-${map.month}-${map.day}T12:00:00-07:00`);
  const wd = d.getUTCDay(); // 0 sun
  const back = (wd + 6) % 7; // monday=0
  d.setUTCDate(d.getUTCDate() - back);
  d.setUTCHours(7, 0, 0, 0); // approx PT midnight
  return d;
}

function listAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export type ByowWeekReport = {
  sessions: number;
  avgMinutes: number;
  uniqueDays: number;
  daysElapsed: number;
  attendancePct: number;
  muscles: MuscleGroup[];
  missingForTwoWeeks: MuscleGroup[];
  cardioDays: number;
  cardioEverySession: boolean;
  narrative: string;
};

export async function buildByowWeekReport(userId: string): Promise<ByowWeekReport> {
  const start = weekStart();
  const twoWeeksAgo = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const logs = await prisma.byowWorkoutLog.findMany({
    where: { userId, completedAt: { gte: twoWeeksAgo } },
    orderBy: { completedAt: "asc" },
  });
  const weekLogs = logs.filter((l) => l.completedAt >= start);
  const sessions = weekLogs.length;
  const durations = weekLogs
    .map((l) => l.durationSec)
    .filter((n): n is number => typeof n === "number" && n > 0);
  const avgMinutes =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60)
      : 0;

  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  const uniqueDays = new Set(weekLogs.map((l) => dayKey(l.completedAt))).size;
  const startDay = dayKey(start);
  const todayKey = dayKey(now);
  let daysElapsed = 1;
  try {
    const a = new Date(startDay + "T12:00:00");
    const b = new Date(todayKey + "T12:00:00");
    daysElapsed = Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
  } catch {
    daysElapsed = 1;
  }
  const attendancePct = Math.min(100, Math.round((uniqueDays / Math.min(7, daysElapsed)) * 100));

  const weekNames = weekLogs.flatMap((l) =>
    l.exerciseNames.split("|").map((s) => s.trim()).filter(Boolean),
  );
  const twoWeekNames = logs.flatMap((l) =>
    l.exerciseNames.split("|").map((s) => s.trim()).filter(Boolean),
  );
  const muscles = musclesFromNames(weekNames);
  const twoWeekMuscles = new Set(musclesFromNames(twoWeekNames));
  const missingForTwoWeeks = MUSCLE_GROUPS.filter((g) => !twoWeekMuscles.has(g));

  const cardioDays = new Set(
    weekLogs
      .filter((l) => l.exerciseNames.split("|").some((n) => isCardioName(n)))
      .map((l) => dayKey(l.completedAt)),
  ).size;
  const cardioEverySession =
    sessions > 0 &&
    weekLogs.every((l) => l.exerciseNames.split("|").some((n) => isCardioName(n)));

  const narrative = buildNarrative({
    sessions,
    avgMinutes,
    uniqueDays,
    attendancePct,
    muscles,
    missingForTwoWeeks,
    cardioDays,
    cardioEverySession,
  });

  return {
    sessions,
    avgMinutes,
    uniqueDays,
    daysElapsed,
    attendancePct,
    muscles,
    missingForTwoWeeks,
    cardioDays,
    cardioEverySession,
    narrative,
  };
}

function buildNarrative(input: {
  sessions: number;
  avgMinutes: number;
  uniqueDays: number;
  attendancePct: number;
  muscles: MuscleGroup[];
  missingForTwoWeeks: MuscleGroup[];
  cardioDays: number;
  cardioEverySession: boolean;
}): string {
  if (input.sessions === 0) {
    return "No sessions logged this week yet. Open one of your notes workouts, check it off, and this recap will fill in.";
  }
  const parts: string[] = [];
  const avg =
    input.avgMinutes > 0 ? ` at an average of ${input.avgMinutes} mins each` : "";
  parts.push(
    `You worked out for ${input.sessions} session${input.sessions === 1 ? "" : "s"}${avg} for the week.`,
  );
  if (input.muscles.length) {
    parts.push(`You focused on ${listAnd(input.muscles.map((m) => GROUP_LABEL[m]))}.`);
    parts.push(input.sessions >= 3 ? "It was a good week." : "Solid start.");
  }
  if (input.missingForTwoWeeks.length) {
    parts.push(
      `Next week add ${listAnd(input.missingForTwoWeeks.slice(0, 3).map((m) => GROUP_LABEL[m]))} to hit all the muscle groups over a two week period.`,
    );
  } else {
    parts.push("You hit all the main muscle groups over this two-week window. Nice coverage.");
  }
  if (input.cardioEverySession) {
    parts.push("You logged fasted cardio each session.");
  } else if (input.cardioDays > 0) {
    parts.push(`You logged cardio on ${input.cardioDays} day${input.cardioDays === 1 ? "" : "s"}.`);
  }
  if (input.attendancePct >= 100) {
    parts.push("You had a 100% attendance record. Nice work.");
  } else if (input.attendancePct >= 70) {
    parts.push(`Attendance is ${input.attendancePct}% of days so far this week. Nice work.`);
  } else {
    parts.push(`Attendance is ${input.attendancePct}% of days so far this week.`);
  }
  return parts.join(" ");
}
