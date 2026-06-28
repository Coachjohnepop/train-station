export type RampDayTemplate = {
  dayNumber: number;
  label: string;
  theme: string;
  notes: string | null;
};

export type RampWeekTemplate = {
  weekNumber: number;
  label: string;
  days: RampDayTemplate[];
};

/** Default 2-week new-member ramp — coach can edit in Settings. */
export const DEFAULT_RAMP_WEEKS: RampWeekTemplate[] = [
  {
    weekNumber: 1,
    label: "Ramp week 1 — learn the rhythm",
    days: [
      { dayNumber: 1, label: "Mon", theme: "Intro + upper body", notes: "15-min intake + light upper warm-up" },
      { dayNumber: 2, label: "Tue", theme: "Mobility + core", notes: "Band work, planks, breathing" },
      { dayNumber: 3, label: "Wed", theme: "Leg day intro", notes: "Goblet squats, lunges, light volume" },
      { dayNumber: 4, label: "Thu", theme: "Shoulders and arms", notes: "Pressing patterns, light loads" },
      { dayNumber: 5, label: "Fri", theme: "Full body primer", notes: "Combine week's patterns" },
      { dayNumber: 6, label: "Sat", theme: "Active recovery", notes: "Walk, stretch, optional cardio" },
      { dayNumber: 7, label: "Sun", theme: "Rest", notes: null },
    ],
  },
  {
    weekNumber: 2,
    label: "Ramp week 2 — build confidence",
    days: [
      { dayNumber: 1, label: "Mon", theme: "Upper push", notes: "Chest + shoulders" },
      { dayNumber: 2, label: "Tue", theme: "Lower body", notes: "Squat + hinge patterns" },
      { dayNumber: 3, label: "Wed", theme: "Upper pull", notes: "Back + biceps" },
      { dayNumber: 4, label: "Thu", theme: "Leg day", notes: "Volume bump, same movements" },
      { dayNumber: 5, label: "Fri", theme: "Full body", notes: "Coach assigns live or SMS workout" },
      { dayNumber: 6, label: "Sat", theme: "Cardio optional", notes: "20–30 min low intensity" },
      { dayNumber: 7, label: "Sun", theme: "Rest", notes: null },
    ],
  },
];

export function normalizeRampWeeks(raw: unknown): RampWeekTemplate[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_RAMP_WEEKS.map((w) => ({
      ...w,
      days: w.days.map((d) => ({ ...d })),
    }));
  }
  const weeks: RampWeekTemplate[] = [];
  for (const w of raw) {
    if (!w || typeof w !== "object") continue;
    const week = w as Partial<RampWeekTemplate>;
    const weekNumber = typeof week.weekNumber === "number" ? week.weekNumber : weeks.length + 1;
    const days: RampDayTemplate[] = [];
    if (Array.isArray(week.days)) {
      for (const d of week.days) {
        if (!d || typeof d !== "object") continue;
        const day = d as Partial<RampDayTemplate>;
        days.push({
          dayNumber: typeof day.dayNumber === "number" ? day.dayNumber : days.length + 1,
          label: typeof day.label === "string" ? day.label : `Day ${days.length + 1}`,
          theme: typeof day.theme === "string" ? day.theme : "Training",
          notes: typeof day.notes === "string" ? day.notes : null,
        });
      }
    }
    weeks.push({
      weekNumber,
      label: typeof week.label === "string" ? week.label : `Week ${weekNumber}`,
      days,
    });
  }
  return weeks.length
    ? weeks
    : DEFAULT_RAMP_WEEKS.map((w) => ({ ...w, days: w.days.map((d) => ({ ...d })) }));
}

export function rampDayForOffset(
  rampWeeks: RampWeekTemplate[],
  dayOffset: number,
): RampDayTemplate | null {
  if (dayOffset < 0) return null;
  let cursor = 0;
  for (const week of rampWeeks) {
    for (const day of week.days) {
      if (cursor === dayOffset) return day;
      cursor += 1;
    }
  }
  return null;
}