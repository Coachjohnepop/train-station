import { assessProgramDayReadiness } from "@/lib/program-day-readiness";
import type { ProgramReadiness, ProgramReadinessInput } from "@/lib/program-readiness";

export type CoachingFocusId =
  | "hypertrophy"
  | "strength"
  | "conditioning"
  | "military-prep"
  | "time-efficient"
  | "general";

export type CoachingFocus = {
  id: CoachingFocusId;
  label: string;
  summary: string;
  weekTheme: string;
};

const FOCUS_BY_SLUG: Record<string, CoachingFocusId> = {
  adult: "general",
  "strength-training": "strength",
  "boot-camp-preparation": "military-prep",
  "mom-dads-little-time": "time-efficient",
  "muscle-max": "hypertrophy",
  "youth-sports": "conditioning",
};

const FOCUS_META: Record<CoachingFocusId, Omit<CoachingFocus, "id">> = {
  hypertrophy: {
    label: "Muscle building",
    summary: "Moderate-heavy compounds + isolation, 8–12 reps, progressive volume.",
    weekTheme: "Push/pull/legs split with extra isolation finishers.",
  },
  strength: {
    label: "Strength & power",
    summary: "Heavy compounds, lower reps, longer rest, speed or plyo finishers.",
    weekTheme: "Squat/bench/deadlift emphasis with accessory strength work.",
  },
  conditioning: {
    label: "Speed & conditioning",
    summary: "Athletic prep — power, agility, intervals, sport-specific volume.",
    weekTheme: "Mix heavy strength days with tempo and conditioning circuits.",
  },
  "military-prep": {
    label: "Military preparation",
    summary: "Resilience, rucks, calisthenics density, work capacity under fatigue.",
    weekTheme: "Grind days + strength maintenance + run/ruck progressions.",
  },
  "time-efficient": {
    label: "Time-efficient training",
    summary: "Supersets, 30–45 min sessions, full-body or upper/lower splits.",
    weekTheme: "Compound pairings — minimal fluff, max stimulus per minute.",
  },
  general: {
    label: "General fitness",
    summary: "Balanced strength, conditioning, and mobility across the week.",
    weekTheme: "Alternate hard strength days with cardio/mobility fillers.",
  },
};

export function inferCoachingFocus(program: {
  slug: string;
  name?: string;
  description?: string;
}): CoachingFocus {
  const id = FOCUS_BY_SLUG[program.slug] ?? "general";
  return { id, ...FOCUS_META[id] };
}

export type AutomationSuggestion = {
  id: string;
  title: string;
  detail: string;
  action: "copy-prev-week" | "copy-week-1-remaining" | "publish-week" | "open-week" | "text-upload";
  weekNumber?: number;
  fromWeekNumber?: number;
  priority: "high" | "medium";
};

export function buildAutomationSuggestions(
  program: ProgramReadinessInput,
  readiness: ProgramReadiness,
  focus: CoachingFocus,
): AutomationSuggestion[] {
  const suggestions: AutomationSuggestion[] = [];
  const { anchorWeek } = readiness;
  const nextWeekNumber = readiness.nextWeek?.weekNumber ?? anchorWeek + 1;

  if (!readiness.currentWeekComplete && readiness.currentWeek) {
    const unpublished = readiness.currentWeek.incompleteDays.filter(
      (d) => d.readiness.reason === "needs-publish",
    ).length;
    const empty = readiness.currentWeek.incompleteDays.filter(
      (d) => d.readiness.reason === "empty" || d.readiness.reason === "missing-workout",
    ).length;

    if (empty > 0) {
      suggestions.push({
        id: `fill-current-${anchorWeek}`,
        title: `Build week ${anchorWeek} (${focus.label})`,
        detail: `${empty} day(s) still empty. ${focus.weekTheme} Paste a week via Text Upload or copy from week ${Math.max(1, anchorWeek - 1)}.`,
        action: anchorWeek > 1 ? "copy-prev-week" : "text-upload",
        weekNumber: anchorWeek,
        fromWeekNumber: anchorWeek > 1 ? anchorWeek - 1 : undefined,
        priority: "high",
      });
    } else if (unpublished > 0) {
      suggestions.push({
        id: `publish-current-${anchorWeek}`,
        title: `Publish week ${anchorWeek}`,
        detail: `${unpublished} day(s) have workouts assigned but aren't published yet. Review and hit Publish on each day.`,
        action: "publish-week",
        weekNumber: anchorWeek,
        priority: "high",
      });
    }
  }

  if (readiness.currentWeekComplete && readiness.nextWeek && !readiness.nextWeekComplete) {
    const emptyNext = readiness.nextWeek.incompleteDays.filter(
      (d) => d.readiness.reason === "empty" || d.readiness.reason === "missing-workout",
    ).length;

    if (emptyNext >= 5) {
      suggestions.push({
        id: `copy-to-next-${nextWeekNumber}`,
        title: `Copy week ${anchorWeek} → week ${nextWeekNumber}`,
        detail: `Clients need the following week ready. Duplicate week ${anchorWeek}, then tweak for ${focus.label.toLowerCase()} progression (${focus.summary}).`,
        action: "copy-prev-week",
        weekNumber: nextWeekNumber,
        fromWeekNumber: anchorWeek,
        priority: "high",
      });
    } else if (emptyNext > 0) {
      suggestions.push({
        id: `finish-next-${nextWeekNumber}`,
        title: `Finish week ${nextWeekNumber}`,
        detail: `${emptyNext} day(s) left in the upcoming week. ${focus.weekTheme}`,
        action: "open-week",
        weekNumber: nextWeekNumber,
        priority: "high",
      });
    } else {
      suggestions.push({
        id: `publish-next-${nextWeekNumber}`,
        title: `Publish week ${nextWeekNumber}`,
        detail: "Upcoming week is drafted — publish each day so members see it in their 10-day window.",
        action: "publish-week",
        weekNumber: nextWeekNumber,
        priority: "medium",
      });
    }
  }

  if (
    readiness.currentWeekComplete &&
    readiness.nextWeekComplete &&
    anchorWeek === 1 &&
    (program.durationWeeks || program.weeks.length) > 2
  ) {
    const week2 = program.weeks.find((w) => w.weekNumber === 2);
    const week2Ready = week2?.days.every((d) => assessProgramDayReadiness(d).complete);
    if (!week2Ready) {
      suggestions.push({
        id: "copy-week1-remaining",
        title: "Stay ahead — seed weeks 2+",
        detail: `You're current for clients. ${focus.label} template: copy week 1 to remaining weeks, then customize progression.`,
        action: "copy-week-1-remaining",
        weekNumber: 1,
        priority: "medium",
      });
    }
  }

  if (suggestions.length === 0 && !readiness.isCurrentWithClients) {
    suggestions.push({
      id: "open-anchor",
      title: `Review week ${anchorWeek}`,
      detail: `Bring week ${anchorWeek} and week ${nextWeekNumber} to published-ready for enrolled members.`,
      action: "open-week",
      weekNumber: anchorWeek,
      priority: "high",
    });
  }

  return suggestions;
}