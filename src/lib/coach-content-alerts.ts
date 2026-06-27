import "server-only";

import fs from "fs";
import path from "path";
import { listPrograms } from "@/lib/program-data";
import {
  buildAutomationSuggestions,
  inferCoachingFocus,
  type AutomationSuggestion,
  type CoachingFocus,
} from "@/lib/program-coaching-focus";
import {
  assessProgramReadiness,
  type ProgramReadiness,
  type ProgramReadinessInput,
} from "@/lib/program-readiness";
import { filterAdminCatalogPrograms } from "@/lib/programs";

const ENROLLMENTS_FILE = path.join(process.cwd(), "prisma", "enrollments.dev.json");

export type EnrollmentStats = {
  memberCount: number;
  maxWeek: number;
};

export function getEnrollmentStatsByProgramSlug(): Record<string, EnrollmentStats> {
  const stats: Record<string, EnrollmentStats> = {};
  if (!fs.existsSync(ENROLLMENTS_FILE)) return stats;

  try {
    const store = JSON.parse(fs.readFileSync(ENROLLMENTS_FILE, "utf8")) as Record<
      string,
      Record<string, { currentWeek: number; currentDay: number }>
    >;
    for (const userEnrolls of Object.values(store)) {
      if (!userEnrolls || typeof userEnrolls !== "object") continue;
      for (const [slug, prog] of Object.entries(userEnrolls)) {
        if (!prog || typeof prog !== "object") continue;
        const week = prog.currentWeek || 1;
        if (!stats[slug]) stats[slug] = { memberCount: 0, maxWeek: 1 };
        stats[slug].memberCount += 1;
        stats[slug].maxWeek = Math.max(stats[slug].maxWeek, week);
      }
    }
  } catch {
    // ignore parse errors in demo file
  }

  return stats;
}

export type CoachContentAlert = {
  programSlug: string;
  programName: string;
  enrolledCount: number;
  focus: CoachingFocus;
  readiness: ProgramReadiness;
  suggestions: AutomationSuggestion[];
};

function toReadinessInput(program: Awaited<ReturnType<typeof listPrograms>>[number]): ProgramReadinessInput {
  return {
    slug: program.slug,
    name: program.name,
    durationWeeks: program.durationWeeks,
    startDate: (program as { startDate?: string | null }).startDate ?? null,
    weeks: program.weeks.map((w: (typeof program.weeks)[number]) => ({
      id: w.id,
      weekNumber: w.weekNumber,
      days: w.days.map((d: (typeof w.days)[number]) => ({
        id: d.id,
        dayNumber: d.dayNumber,
        workoutId: d.workoutId,
        publishedAt: (d as { publishedAt?: string | null }).publishedAt ?? null,
        options: (d as { options?: Array<{ workoutId: string; label: string }> }).options,
      })),
    })),
  };
}

export async function loadCoachContentAlerts(): Promise<CoachContentAlert[]> {
  const programs = filterAdminCatalogPrograms(await listPrograms());
  const enrollmentStats = getEnrollmentStatsByProgramSlug();

  const alerts: CoachContentAlert[] = [];

  for (const program of programs) {
    const cat = (program.category || "workout") as string;
    if (cat !== "workout") continue;

    const enroll = enrollmentStats[program.slug] ?? { memberCount: 0, maxWeek: 1 };
    const input = toReadinessInput(program);
    const focus = inferCoachingFocus(program);
    const readiness = assessProgramReadiness(input, enroll.maxWeek);
    const suggestions = buildAutomationSuggestions(input, readiness, focus);

    if (readiness.isCurrentWithClients && enroll.memberCount === 0) continue;
    if (readiness.isCurrentWithClients) {
      alerts.push({
        programSlug: program.slug,
        programName: program.name,
        enrolledCount: enroll.memberCount,
        focus,
        readiness,
        suggestions,
      });
      continue;
    }

    alerts.push({
      programSlug: program.slug,
      programName: program.name,
      enrolledCount: enroll.memberCount,
      focus,
      readiness,
      suggestions,
    });
  }

  return alerts.sort((a, b) => {
    const levelScore = { critical: 0, warn: 1, ok: 2 };
    const diff = levelScore[a.readiness.alertLevel] - levelScore[b.readiness.alertLevel];
    if (diff !== 0) return diff;
    return b.enrolledCount - a.enrolledCount;
  });
}

export async function loadProgramContentAlert(
  slug: string,
): Promise<CoachContentAlert | null> {
  const alerts = await loadCoachContentAlerts();
  return alerts.find((a) => a.programSlug === slug) ?? null;
}