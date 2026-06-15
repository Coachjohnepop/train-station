import fs from "fs";
import path from "path";

export async function loadMemberLoggedWorkoutIds(uid: string): Promise<Set<string>> {
  const loggedSet = new Set<string>();
  const isDemo = process.env.DATABASE_URL?.includes("dummy") ?? true;

  if (isDemo) {
    try {
      const logsPath = path.join(process.cwd(), "prisma", "logs.dev.json");
      if (fs.existsSync(logsPath)) {
        const logsData = JSON.parse(fs.readFileSync(logsPath, "utf8"));
        (logsData.workoutLogs || []).forEach((log: { userId?: string; workoutId?: string }) => {
          if (log.userId === uid && log.workoutId) {
            loggedSet.add(log.workoutId);
          }
        });
      }
    } catch {
      // ignore
    }
    return loggedSet;
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    const logs = await prisma.workoutLog.findMany({
      where: { userId: uid },
      select: { workoutId: true },
    });
    logs.forEach((l) => {
      if (l.workoutId) loggedSet.add(l.workoutId);
    });
  } catch {
    // ignore
  }

  return loggedSet;
}

export function hasAssignedWorkout(day: {
  workout?: unknown;
  options?: unknown[];
}): boolean {
  return !!(day.workout || (day.options && day.options.length > 0));
}

export function computeScheduleProgress(
  program: { weeks: Array<{ weekNumber: number; days: Array<{ dayNumber?: number; options?: Array<{ workoutId: string }>; workoutId?: string }> }> },
  curWeek: number,
  curDay: number,
  loggedSet: Set<string>,
  isWorkout: boolean,
) {
  const allDays = program.weeks.flatMap((w) => w.days);
  const assignedDays = isWorkout ? allDays.filter(hasAssignedWorkout) : allDays;
  const totalAssigned = assignedDays.length;

  let completedCount = 0;
  program.weeks.forEach((w) => {
    (w.days || []).forEach((d) => {
      if (isWorkout && !hasAssignedWorkout(d)) return;
      const dayBeforeCurrent =
        w.weekNumber < curWeek || (w.weekNumber === curWeek && (d.dayNumber || 0) < curDay);
      const hasLoggedOption =
        (d.options || []).some((o) => loggedSet.has(o.workoutId)) ||
        (d.workoutId && loggedSet.has(d.workoutId));
      if (dayBeforeCurrent || hasLoggedOption) completedCount++;
    });
  });

  return { totalAssigned, completedCount, assignedDays };
}