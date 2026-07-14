/**
 * Multi-part program days (military double/triple days, etc.).
 *
 * Model:
 *   ProgramDay          → calendar day (Mon…Sun / cycle day)
 *   ProgramDaySession   → ordered part (AM / midday / PM) — 1..MAX_DAY_PARTS
 *   ProgramDayOption    → Gym/Home track *within* a part
 *
 * Gym vs Home is NOT a separate "part" — it's an option under a session.
 * Parts can be strength, cardio (e.g. fasted cardio middle), mobility, recovery, or custom.
 */

export const MAX_DAY_PARTS = 5;

/** Soft product default for military-style days (AM / mid / PM). */
export const TYPICAL_MAX_DAY_PARTS = 3;

export const PROGRAM_SESSION_KINDS = [
  "strength",
  "cardio",
  "mobility",
  "recovery",
  "custom",
] as const;

export type ProgramSessionKind = (typeof PROGRAM_SESSION_KINDS)[number];

export const PROGRAM_TIME_SLOTS = [
  "morning",
  "midday",
  "afternoon",
  "evening",
] as const;

export type ProgramTimeSlot = (typeof PROGRAM_TIME_SLOTS)[number] | (string & {});

export type ProgramDaySessionInput = {
  partIndex: number;
  label: string;
  sessionKind?: ProgramSessionKind | string;
  timeSlot?: string | null;
  notes?: string | null;
  sortOrder?: number;
};

/** Default labels when coach adds part 1/2/3 without custom names. */
export function defaultPartLabel(partIndex: number, totalParts: number): string {
  if (totalParts <= 1) return "Main";
  if (totalParts === 2) {
    return partIndex === 1 ? "AM Session" : "PM Session";
  }
  if (partIndex === 1) return "AM Session";
  if (partIndex === totalParts) return "PM Session";
  return "Midday Session";
}

export function defaultPartTimeSlot(
  partIndex: number,
  totalParts: number,
): string | null {
  if (totalParts <= 1) return null;
  if (totalParts === 2) return partIndex === 1 ? "morning" : "evening";
  if (partIndex === 1) return "morning";
  if (partIndex === totalParts) return "evening";
  return "midday";
}

/** Middle part on a 3-part day defaults to cardio (fasted cardio use-case). */
export function defaultPartKind(
  partIndex: number,
  totalParts: number,
): ProgramSessionKind {
  if (totalParts >= 3 && partIndex > 1 && partIndex < totalParts) {
    return "cardio";
  }
  return "strength";
}

export function clampPartCount(n: number): number {
  const v = Math.floor(Number(n) || 1);
  return Math.min(MAX_DAY_PARTS, Math.max(1, v));
}

export function isProgramSessionKind(value: string | null | undefined): value is ProgramSessionKind {
  return PROGRAM_SESSION_KINDS.includes(value as ProgramSessionKind);
}

/**
 * Build session shells when coach sets partCount (does not create workouts).
 * Existing sessions by partIndex are preserved in callers; this is for new shells.
 */
export function buildSessionShells(partCount: number): ProgramDaySessionInput[] {
  const total = clampPartCount(partCount);
  return Array.from({ length: total }, (_, i) => {
    const partIndex = i + 1;
    return {
      partIndex,
      label: defaultPartLabel(partIndex, total),
      sessionKind: defaultPartKind(partIndex, total),
      timeSlot: defaultPartTimeSlot(partIndex, total),
      sortOrder: i,
    };
  });
}

export type DayWithSessionsLike = {
  id: string;
  partCount?: number | null;
  sessions?: Array<{
    id: string;
    partIndex: number;
    label: string;
    sessionKind?: string | null;
    timeSlot?: string | null;
    notes?: string | null;
    sortOrder?: number;
    options?: Array<{
      id?: string;
      workoutId: string;
      label: string;
      trainingLocation?: string | null;
      notes?: string | null;
      sortOrder?: number;
    }>;
  }>;
  /** Legacy flat options (pre multi-part) */
  options?: Array<{
    id?: string;
    workoutId: string;
    label: string;
    sessionId?: string | null;
    trainingLocation?: string | null;
    notes?: string | null;
    sortOrder?: number;
  }>;
};

/**
 * Normalize API/UI shape: always expose sessions[]; if only legacy options exist,
 * wrap them as a single Main session.
 */
export function normalizeDaySessions<T extends DayWithSessionsLike>(day: T): T & {
  partCount: number;
  sessions: NonNullable<DayWithSessionsLike["sessions"]>;
} {
  if (day.sessions && day.sessions.length > 0) {
    const sorted = [...day.sessions].sort(
      (a, b) => (a.sortOrder ?? a.partIndex) - (b.sortOrder ?? b.partIndex),
    );
    return {
      ...day,
      partCount: clampPartCount(day.partCount ?? sorted.length),
      sessions: sorted,
    };
  }

  const legacy = day.options ?? [];
  return {
    ...day,
    partCount: 1,
    sessions: [
      {
        id: `legacy-main-${day.id}`,
        partIndex: 1,
        label: "Main",
        sessionKind: "strength",
        timeSlot: null,
        notes: null,
        sortOrder: 0,
        options: legacy.map((o) => ({
          id: o.id,
          workoutId: o.workoutId,
          label: o.label,
          trainingLocation: o.trainingLocation,
          notes: o.notes,
          sortOrder: o.sortOrder ?? 0,
        })),
      },
    ],
  };
}
