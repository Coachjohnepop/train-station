"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SearchableExerciseSelect, {
  type LibraryExercise,
} from "@/components/SearchableExerciseSelect";
import { DAY_LABELS, PROGRAM_CYCLE_DAYS } from "@/lib/program-constants";
import {
  coordinateFromEnrollmentDay,
  cycleDayKeyFromLinear,
  formatCycleDayFromWeekDay,
  linearEnrollmentDay,
  programCycleDayCount,
} from "@/lib/member-enrollment-day";
import {
  cloneWorkoutContentName,
  defaultTrackWorkoutTitle,
  findCatalogHomeForProgramDay,
  repairedStoredWorkoutTitle,
  workoutContentTitle,
  workoutsMatchByContentTitle,
} from "@/lib/workout-content-name";
import {
  calendarDateForProgramDay,
  columnSlotCountsForExerciseCount,
  daysInMonth,
  DEFAULT_COLUMN_SLOT_COUNTS,
  DEFAULT_DAY_OPTIONS,
  formatMonthYear,
  formatShortDate,
  formatTrainingLocationLabel,
  DAY_OFF_LABEL,
  DEFAULT_FASTED_CARDIO_MINUTES,
  FASTED_CARDIO_LABEL,
  fastedCardioReps,
  isDayOffLabel,
  isFastedCardioLabel,
  isGymLabel,
  isHomeLabel,
  isWorkoutSharedAcrossProgramDays,
  isWorkoutDayLabel,
  mondayOfWeek,
  normalizeDayOptions,
  parseFastedCardioMinutes,
  parseIsoDate,
  resolveProgramStartMonday,
  slotIndicesForTimeColumn,
  timeBlockLabel,
  trainingLocationFromLabel,
  adjacentProgramDay,
  findProgramDayForCalendarDate,
  localTodayIso,
  toIsoDate,
  totalSlotsFromColumnCounts,
  DAY_TIME_BLOCK_COUNT,
} from "@/lib/program-calendar";
import {
  DEFAULT_DAY_PRESCRIPTION,
  readDayPrescription,
  type DayPrescription,
} from "@/lib/program-day-prescription";
import ProgramContentReadinessBanner from "@/components/ProgramContentReadinessBanner";
import ProgramTemplatePastePanel from "@/components/ProgramTemplatePastePanel";
import TextUploadPanel from "@/components/TextUploadPanel";
import type { CoachContentAlert } from "@/lib/coach-content-alerts";

type WorkoutOption = { id: string; name: string };

type DayOption = {
  workoutId: string;
  label: string;
  trainingLocation?: "gym" | "home" | null;
  notes?: string | null;
  sessionId?: string | null;
  partIndex?: number;
};

type DaySession = {
  id: string;
  partIndex: number;
  label: string;
  sessionKind?: string | null;
  timeSlot?: string | null;
  notes?: string | null;
  sortOrder?: number;
  options?: DayOption[];
};

type ProgramDay = {
  id: string;
  dayNumber: number;
  workoutId: string | null;
  calendarDate?: string | null;
  defaultSets?: number | null;
  defaultReps?: string | null;
  defaultRestSec?: number | null;
  publishedAt?: string | null;
  videoUrl?: string | null;
  notes?: string | null;
  partCount?: number;
  sessions?: DaySession[];
  options?: DayOption[];
};

type ProgramWeek = { id: string; weekNumber: number; days: ProgramDay[] };

type Program = {
  id: string;
  slug: string;
  name: string;
  durationWeeks: number;
  startDate?: string | null;
  weeks: ProgramWeek[];
};

type SlotItem = {
  id: string;
  exerciseId: string;
  name: string;
  sets: number | null;
  reps: string | null;
  restSec: number | null;
  /** Coach note for this workout line only (not the library exercise). */
  notes: string | null;
  sortOrder: number;
};

type Focus = {
  dayId: string;
  optIdx: number;
  workoutId: string;
  label: string;
  weekNumber: number;
  dayNumber: number;
  /** 1-based multi-part index (military double/triple days). */
  partIndex?: number;
};

function daySessions(day: ProgramDay): DaySession[] {
  if (day.sessions && day.sessions.length > 0) {
    return [...day.sessions].sort(
      (a, b) => (a.sortOrder ?? a.partIndex) - (b.sortOrder ?? b.partIndex),
    );
  }
  const opts = day.options || [];
  return [
    {
      id: `legacy-${day.id}`,
      partIndex: 1,
      label: "Main",
      sessionKind: "strength",
      options: opts,
    },
  ];
}

function getDayOptions(day: ProgramDay, partIndex = 1): DayOption[] {
  const sessions = daySessions(day);
  // Never fall back to another part's session — that made Part 2 show Part 1 workouts.
  const session = sessions.find((s) => s.partIndex === partIndex);
  if (session?.options && session.options.length > 0) {
    return normalizeDayOptions(
      session.options.map((o) => ({ ...o, partIndex, sessionId: session.id })),
    ) as DayOption[];
  }
  // Flat options may include sessionId / partIndex
  if (day.options && day.options.length > 0) {
    const filtered = day.options.filter((o) => {
      if (o.partIndex != null) return o.partIndex === partIndex;
      if (session?.id && o.sessionId) return o.sessionId === session.id;
      // Legacy rows without part/session only belong to part 1
      return partIndex === 1 && !o.sessionId && o.partIndex == null;
    });
    if (filtered.length > 0) {
      return normalizeDayOptions(
        filtered.map((o) => ({ ...o, partIndex })),
      ) as DayOption[];
    }
    // Part 1 only: legacy flat options with no part metadata
    if (partIndex === 1) {
      const legacy = day.options.filter((o) => o.partIndex == null && !o.sessionId);
      if (legacy.length > 0) return normalizeDayOptions(legacy) as DayOption[];
    }
  }
  if (partIndex === 1 && day.workoutId) return [{ workoutId: day.workoutId, label: "Gym" }];
  return [];
}

function dayKindLabel(day: ProgramDay): string {
  const parts = day.partCount ?? daySessions(day).length;
  if (parts > 1) {
    return `${parts}-part day`;
  }
  const opts = getDayOptions(day, 1);
  if (opts.some((o) => isDayOffLabel(o.label))) return "Day off";
  if (opts.some((o) => isFastedCardioLabel(o.label))) return "Fasted cardio";
  if (opts.some((o) => isGymLabel(o.label)) && opts.some((o) => isHomeLabel(o.label))) {
    return "Gym · Home";
  }
  if (opts.some((o) => isGymLabel(o.label))) return "Gym workout";
  if (opts.some((o) => isHomeLabel(o.label))) return "Home workout";
  if (opts.length === 0) return "Empty";
  return `${opts.length} setting${opts.length === 1 ? "" : "s"}`;
}

/** Custom settings only — Gym/Home are always in the bean row. */
function customSettingOptions(day: ProgramDay, partIndex = 1): DayOption[] {
  return getDayOptions(day, partIndex).filter(
    (o) =>
      !isGymLabel(o.label) &&
      !isHomeLabel(o.label) &&
      !isDayOffLabel(o.label) &&
      !isFastedCardioLabel(o.label),
  );
}

function beanButtonClass(active: boolean): string {
  return active
    ? "rounded-full border border-emerald-400 bg-emerald-500/25 px-2.5 py-1 text-[10px] font-bold text-[var(--success)] ring-1 ring-emerald-400/60"
    : "rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-medium text-[var(--muted)] hover:border-emerald-400/40 hover:text-[var(--text)]";
}

function dayGridCardClasses(isSelected: boolean, published: boolean): string {
  const highlighted = isSelected || published;
  const parts = ["w-full rounded-lg p-2 text-left transition"];
  if (highlighted) {
    parts.push(
      published
        ? "border-4 border-emerald-400 bg-emerald-500/25 shadow-[0_0_12px_rgba(74,222,154,0.25)]"
        : "border-2 border-emerald-400 bg-emerald-500/20 shadow-sm",
    );
  } else {
    parts.push("border border-[var(--border)] bg-[var(--surface-2)] hover:border-emerald-400/30");
  }
  return parts.join(" ");
}

function dayGridTextClass(isSelected: boolean, published: boolean, variant: "title" | "meta"): string {
  const highlighted = isSelected || published;
  if (variant === "title") {
    return highlighted ? "text-emerald-50 font-bold" : "text-[var(--text)] font-bold";
  }
  return highlighted ? "text-[var(--success)]/80" : "text-[var(--muted)]";
}

function dayOptionsNeedCleanup(day: ProgramDay): boolean {
  if (!day.options?.length) return false;
  const normalized = normalizeDayOptions(day.options);
  if (normalized.length !== day.options.length) return true;
  return day.options.some(
    (opt, idx) =>
      opt.label !== normalized[idx]?.label || opt.workoutId !== normalized[idx]?.workoutId,
  );
}

export default function ProgramCalendarBuilder({
  program: initial,
  workouts: initialWorkouts,
  contentAlert = null,
}: {
  program: Program;
  workouts: WorkoutOption[];
  contentAlert?: CoachContentAlert | null;
}) {
  const [program, setProgram] = useState(initial);
  const [allWorkouts, setAllWorkouts] = useState(initialWorkouts);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const calendarToday = useMemo(() => {
    const iso = localTodayIso();
    const match = findProgramDayForCalendarDate(program, iso);
    if (!match) return null;
    return { weekNumber: match.weekNumber, dayNumber: match.dayNumber, iso };
  }, [program]);
  const [activeWeek, setActiveWeek] = useState(() => calendarToday?.weekNumber ?? 1);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [columnSlotCounts, setColumnSlotCounts] = useState<number[]>([...DEFAULT_COLUMN_SLOT_COUNTS]);
  const [slots, setSlots] = useState<(SlotItem | null)[]>(
    Array(totalSlotsFromColumnCounts(DEFAULT_COLUMN_SLOT_COUNTS)).fill(null),
  );
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const editorRef = useRef<HTMLDivElement>(null);
  const setsInputRef = useRef<HTMLInputElement>(null);
  const uploadPanelRef = useRef<HTMLDivElement>(null);
  const dragFromIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [prescription, setPrescription] = useState<DayPrescription>(DEFAULT_DAY_PRESCRIPTION);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [duplicateTargets, setDuplicateTargets] = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);
  const [checkedSlots, setCheckedSlots] = useState<Set<number>>(() => new Set());
  const [editorSets, setEditorSets] = useState(DEFAULT_DAY_PRESCRIPTION.defaultSets);
  const [editorReps, setEditorReps] = useState(DEFAULT_DAY_PRESCRIPTION.defaultReps);
  const [editorRest, setEditorRest] = useState(DEFAULT_DAY_PRESCRIPTION.defaultRestSec);
  const [editorNotes, setEditorNotes] = useState("");
  const [fastedCardioMinutes, setFastedCardioMinutes] = useState(DEFAULT_FASTED_CARDIO_MINUTES);
  const [workoutPreviews, setWorkoutPreviews] = useState<Record<string, string[]>>({});
  const [workoutTitle, setWorkoutTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [optionNotes, setOptionNotes] = useState("");
  const [savingOptionNotes, setSavingOptionNotes] = useState(false);
  const optionNotesDirtyRef = useRef(false);
  /** When true, copy/paste/duplicate clears day descriptions (avoids "Welcome Day one…" on week 2). */
  const [autoClearNotesOnCopy, setAutoClearNotesOnCopy] = useState(true);
  /** Ref so long week-copy loops always see the checkbox value (no stale closure). */
  const autoClearNotesOnCopyRef = useRef(true);
  /** Import a week from another program (e.g. Adult/Athletes → Military). */
  const [importSourceSlug, setImportSourceSlug] = useState("adult");
  const [importSourceWeek, setImportSourceWeek] = useState(1);
  const [importSourceMaxWeek, setImportSourceMaxWeek] = useState(22);
  const [importBusy, setImportBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ts-auto-clear-notes-on-copy");
      if (raw === "0") {
        setAutoClearNotesOnCopy(false);
        autoClearNotesOnCopyRef.current = false;
      }
      if (raw === "1") {
        setAutoClearNotesOnCopy(true);
        autoClearNotesOnCopyRef.current = true;
      }
    } catch {
      /* ignore */
    }
  }, []);

  function setAutoClearNotesOnCopyPersist(next: boolean) {
    setAutoClearNotesOnCopy(next);
    autoClearNotesOnCopyRef.current = next;
    try {
      localStorage.setItem("ts-auto-clear-notes-on-copy", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  /**
   * Day description (Gym/Home option notes + program day.notes) for copy/paste.
   * When auto-clear is on → always null so week 2+ never keeps “Welcome Day one…”.
   */
  function notesForCopy(sourceNotes: string | null | undefined): string | null {
    if (autoClearNotesOnCopyRef.current) return null;
    const raw = sourceNotes ?? null;
    if (raw == null) return null;
    const trimmed = String(raw).trim();
    return trimmed ? trimmed : null;
  }

  const startMonday = useMemo(
    () => resolveProgramStartMonday(program.startDate),
    [program.startDate],
  );
  const thisWeekMondayIso = useMemo(() => toIsoDate(mondayOfWeek(new Date())), []);
  const anchorIsStale = useMemo(() => {
    // Flag when Week 1 Monday is not this calendar week (design page still shows last month).
    return toIsoDate(startMonday) !== thisWeekMondayIso;
  }, [startMonday, thisWeekMondayIso]);

  const weeks = useMemo(
    () => [...program.weeks].sort((a, b) => a.weekNumber - b.weekNumber),
    [program.weeks],
  );

  const attentionWeeks = useMemo(() => {
    if (!contentAlert) return new Set<number>();
    const { readiness } = contentAlert;
    const weeks = new Set<number>();
    if (!readiness.currentWeekComplete) weeks.add(readiness.anchorWeek);
    if (readiness.nextWeek && !readiness.nextWeekComplete) {
      weeks.add(readiness.nextWeek.weekNumber);
    }
    return weeks;
  }, [contentAlert]);

  const activeWeekData = weeks.find((w) => w.weekNumber === activeWeek) || weeks[0];
  const cycleDays = programCycleDayCount(program.durationWeeks, PROGRAM_CYCLE_DAYS);

  const focusEnrollmentDay = focus
    ? linearEnrollmentDay(focus.weekNumber, focus.dayNumber)
    : null;

  const sync = useCallback(async () => {
    const res = await fetch(`/api/programs/${program.slug}/sync`, { method: "POST" });
    if (res.ok) setProgram(await res.json());
  }, [program.slug]);

  useEffect(() => {
    fetch("/api/exercises")
      .then((r) => r.json())
      .then((data) =>
        setLibrary(data.map((e: LibraryExercise) => ({ id: e.id, name: e.name, tags: e.tags }))),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (program.weeks.length < program.durationWeeks) void sync();
  }, [program.durationWeeks, program.weeks.length, sync]);

  const loadWorkoutPreview = useCallback(async (workoutId: string) => {
    if (!workoutId) return;
    const res = await fetch(`/api/workouts/${workoutId}`, { cache: "no-store" });
    if (!res.ok) return;
    const workout = await res.json();
    const names = (workout.exercises || [])
      .slice(0, 3)
      .map((item: { exercise?: { name?: string } }) => item.exercise?.name)
      .filter(Boolean) as string[];
    setWorkoutPreviews((prev) => ({ ...prev, [workoutId]: names }));
  }, []);

  useEffect(() => {
    const ids = new Set<string>();
    for (const week of program.weeks) {
      for (const day of week.days) {
        for (const opt of getDayOptions(day)) {
          if (opt.workoutId) ids.add(opt.workoutId);
        }
      }
    }
    for (const id of ids) {
      if (!workoutPreviews[id]) void loadWorkoutPreview(id);
    }
    // workoutPreviews intentionally omitted — only fetch IDs not yet cached
  }, [program.weeks, loadWorkoutPreview]);

  function previewForDay(day: ProgramDay, weekNumber: number): string | null {
    const opts = getDayOptions(day);
    if (opts.some((o) => isDayOffLabel(o.label))) return "Rest day";
    const titles: string[] = [];
    for (const opt of opts) {
      if (!opt.workoutId) continue;
      const fromLibrary = allWorkouts.find((w) => w.id === opt.workoutId);
      const title = fromLibrary
        ? workoutContentTitle(fromLibrary.name)
        : workoutPreviews[opt.workoutId]?.[0];
      if (title) titles.push(title);
    }
    if (titles.length) return titles.join(" · ");
    return dayKindLabel(day);
  }

  async function patchDay(dayId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/programs/days/${dayId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail =
        (typeof body.detail === "string" && body.detail) ||
        (typeof body.message === "string" && body.message) ||
        "Day save failed";
      throw new Error(detail);
    }
    const updated = await res.json();
    setProgram((prev) => ({
      ...prev,
      weeks: prev.weeks.map((w) => ({
        ...w,
        days: w.days.map((d) =>
          d.id === dayId
            ? {
                ...d,
                // Prefer server response over request patch so multi-part
                // options/sessions never get partially overwritten.
                ...updated,
                options: updated.options ?? d.options,
                sessions: updated.sessions ?? d.sessions,
                partCount: updated.partCount ?? d.partCount,
                workoutId:
                  updated.workoutId !== undefined ? updated.workoutId : d.workoutId,
              }
            : d,
        ),
      })),
    }));
    return updated;
  }

  /** Reload program tree from server (used after paste / multi-part edits). */
  async function reloadProgramTree(): Promise<Program | null> {
    try {
      const res = await fetch(`/api/programs/${program.slug}`, { cache: "no-store" });
      if (res.ok) {
        const fresh = await res.json();
        if (fresh?.weeks) {
          setProgram((prev) => ({ ...prev, ...fresh, weeks: fresh.weeks }));
          return fresh as Program;
        }
      }
    } catch {
      /* fall through to sync */
    }
    try {
      const res = await fetch(`/api/programs/${program.slug}/sync`, { method: "POST" });
      if (res.ok) {
        const fresh = await res.json();
        if (fresh?.weeks) {
          setProgram((prev) => ({ ...prev, ...fresh, weeks: fresh.weeks }));
          return fresh as Program;
        }
      }
    } catch {
      /* non-fatal */
    }
    return null;
  }

  async function setDayOptions(
    dayId: string,
    options: DayOption[],
    opts?: { silent?: boolean; partIndex?: number },
  ) {
    const silent = opts?.silent === true;
    const partIndex = opts?.partIndex ?? focus?.partIndex ?? 1;
    if (!silent) setSaving(true);
    try {
      const withPart = (normalizeDayOptions(options) as DayOption[]).map((o) => ({
        ...o,
        partIndex,
      }));
      await patchDay(dayId, { options: withPart });
      if (!silent) {
        setMessage("Saved.");
        setTimeout(() => setMessage(null), 1500);
      }
    } catch (e) {
      if (!silent) {
        const msg = e instanceof Error && e.message ? e.message : "Could not save — try again.";
        setMessage(msg);
        setTimeout(() => setMessage(null), 4000);
      }
    } finally {
      if (!silent) setSaving(false);
    }
  }

  async function setDayPartCount(dayId: string, partCount: number) {
    setSaving(true);
    try {
      const updated = await patchDay(dayId, { partCount });
      const nextPart = Math.min(
        Math.max(1, focus?.dayId === dayId ? focus.partIndex ?? 1 : 1),
        partCount,
      );
      setFocus((f) =>
        f && f.dayId === dayId ? { ...f, partIndex: nextPart } : f,
      );
      setMessage(
        partCount <= 1
          ? "Single-part day."
          : `${partCount}-part day — switch parts below to assign each session (Gym/Home per part).`,
      );
      setTimeout(() => setMessage(null), 3500);
      // Re-open using the server day (sessions for new parts) so Part 2/3 is writable immediately.
      if (focus?.dayId === dayId) {
        const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
        const day = week?.days.find((d) => d.id === dayId);
        if (week && day) {
          const updatedDay: ProgramDay = {
            ...day,
            partCount: updated.partCount ?? partCount,
            sessions: updated.sessions ?? day.sessions,
            options: updated.options ?? day.options,
            workoutId:
              updated.workoutId !== undefined ? updated.workoutId : day.workoutId,
          };
          await openDayOption(
            updatedDay,
            week,
            focus.optIdx,
            focus.label || "Gym",
            nextPart,
          );
        }
      }
    } catch (e) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "Could not update day parts — try again.";
      setMessage(msg);
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  function scrollToEditor() {
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function resetSlotGrid() {
    setColumnSlotCounts([...DEFAULT_COLUMN_SLOT_COUNTS]);
    setSlots(Array(totalSlotsFromColumnCounts(DEFAULT_COLUMN_SLOT_COUNTS)).fill(null));
  }

  function resolveDetachCloneSourceId(
    day: ProgramDay,
    label: string,
    sharedWorkoutId: string,
    partIndex = 1,
  ): string {
    if (!isHomeLabel(label)) return sharedWorkoutId;

    const gymOpt = getDayOptions(day, partIndex).find((o) => isGymLabel(o.label) && o.workoutId);
    const gymWorkout = gymOpt ? allWorkouts.find((w) => w.id === gymOpt.workoutId) : null;
    const sharedWorkout = allWorkouts.find((w) => w.id === sharedWorkoutId);
    if (gymWorkout && sharedWorkout) {
      const alreadyPaired = workoutsMatchByContentTitle(gymWorkout.name, sharedWorkout.name);
      if (!alreadyPaired) {
        const template = findCatalogHomeForProgramDay(
          day.dayNumber,
          gymWorkout.name,
          allWorkouts,
        );
        if (template?.id) return template.id;
      }
    }
    return sharedWorkoutId;
  }

  /** Same workout used on another part of this day (or another day) — must clone before edit. */
  function workoutSharedOnDayParts(
    day: ProgramDay,
    workoutId: string,
    exceptPartIndex: number,
  ): boolean {
    if (!workoutId?.trim()) return false;
    const parts = day.partCount ?? daySessions(day).length;
    for (let p = 1; p <= Math.max(parts, daySessions(day).length); p++) {
      if (p === exceptPartIndex) continue;
      if (getDayOptions(day, p).some((o) => o.workoutId === workoutId)) return true;
    }
    return false;
  }

  async function detachSharedWorkoutForOption(
    dayId: string,
    optIdx: number,
    label: string,
    day: ProgramDay,
    workoutId: string,
    partIndex = 1,
  ): Promise<string> {
    const sharedElsewhere =
      isWorkoutSharedAcrossProgramDays(program, workoutId, dayId) ||
      workoutSharedOnDayParts(day, workoutId, partIndex);
    if (!sharedElsewhere) {
      return workoutId;
    }

    const cloneSourceId = resolveDetachCloneSourceId(day, label, workoutId, partIndex);
    const sourceWorkout = allWorkouts.find((w) => w.id === cloneSourceId);
    const cloneRes = await fetch(`/api/workouts/${cloneSourceId}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cloneWorkoutContentName(sourceWorkout?.name || "", label),
      }),
    });
    if (!cloneRes.ok) return workoutId;

    const cloned = await cloneRes.json();
    const opts = [...getDayOptions(day, partIndex)];
    while (opts.length <= optIdx) {
      opts.push({ workoutId: "", label: DEFAULT_DAY_OPTIONS[opts.length] || "Custom" });
    }
    opts[optIdx] = { workoutId: cloned.id, label: opts[optIdx].label || label };
    await setDayOptions(dayId, opts, { silent: true, partIndex });
    setAllWorkouts((prev) =>
      prev.some((w) => w.id === cloned.id) ? prev : [...prev, { id: cloned.id, name: cloned.name }],
    );
    setMessage("This session now has its own workout — edits won't affect other parts/days.");
    setTimeout(() => setMessage(null), 3000);
    return cloned.id as string;
  }

  async function ensureWorkoutForOption(
    dayId: string,
    optIdx: number,
    label: string,
    dayOverride?: ProgramDay,
    partIndex = 1,
  ): Promise<{ workoutId: string; created: boolean } | null> {
    const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
    const day = dayOverride ?? week?.days.find((d) => d.id === dayId);
    if (!week || !day) return null;

    // Critical: scope to this part only — part 2 must never read/write part 1 options.
    const opts = [...getDayOptions(day, partIndex)];
    if (opts[optIdx]?.workoutId) {
      const workoutId = await detachSharedWorkoutForOption(
        dayId,
        optIdx,
        label,
        day,
        opts[optIdx].workoutId,
        partIndex,
      );
      return { workoutId, created: false };
    }

    const cal =
      day.calendarDate ||
      calendarDateForProgramDay(startMonday, week.weekNumber, day.dayNumber);
    const partLabel =
      daySessions(day).find((s) => s.partIndex === partIndex)?.label ||
      (partIndex > 1 ? `Part ${partIndex}` : "");
    const suggestedName = partLabel
      ? `${defaultTrackWorkoutTitle(label)} · ${partLabel}`
      : defaultTrackWorkoutTitle(label);

    const createRes = await fetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: suggestedName }),
    });
    if (!createRes.ok) return null;
    const created = await createRes.json();

    while (opts.length <= optIdx) {
      opts.push({ workoutId: "", label: DEFAULT_DAY_OPTIONS[opts.length] || "Custom" });
    }
    opts[optIdx] = { workoutId: created.id, label: opts[optIdx].label || label };

    await setDayOptions(dayId, opts, { silent: true, partIndex });
    setAllWorkouts((prev) =>
      prev.some((w) => w.id === created.id) ? prev : [...prev, { id: created.id, name: created.name }],
    );

    if (!day.calendarDate) {
      await patchDay(dayId, { calendarDate: cal });
    }

    const warmupSeed = created.warmupSeed as
      | { added?: number; message?: string; missing?: string[] }
      | null
      | undefined;
    if (warmupSeed?.message) {
      setMessage(warmupSeed.message);
      setTimeout(() => setMessage(null), warmupSeed.added === 0 ? 4500 : 2500);
    }

    return { workoutId: created.id as string, created: true };
  }

  function syncEditorFromSlot(slot: SlotItem | null, rx: DayPrescription) {
    if (slot) {
      setEditorSets(slot.sets ?? rx.defaultSets);
      setEditorReps(slot.reps ?? rx.defaultReps);
      setEditorRest(slot.restSec ?? rx.defaultRestSec);
      setEditorNotes(slot.notes ?? "");
    } else {
      setEditorSets(rx.defaultSets);
      setEditorReps(rx.defaultReps);
      setEditorRest(rx.defaultRestSec);
      setEditorNotes("");
    }
  }

  function focusSetsEditor() {
    requestAnimationFrame(() => {
      setsInputRef.current?.focus();
      setsInputRef.current?.select();
    });
  }

  function selectSlot(
    idx: number,
    grid: (SlotItem | null)[],
    rx: DayPrescription,
    opts?: { focusEditor?: boolean },
  ) {
    setSelectedSlotIdx(idx);
    syncEditorFromSlot(grid[idx], rx);
    if (opts?.focusEditor) focusSetsEditor();
  }

  const loadSlots = useCallback(async (workoutId: string, rx?: DayPrescription) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/workouts/${workoutId}`, { cache: "no-store" });
      if (!res.ok) {
        resetSlotGrid();
        setSelectedSlotIdx(null);
        return;
      }
      const w = await res.json();
      const previewNames = (w.exercises || [])
        .slice(0, 3)
        .map((it: { exercise?: { name?: string } }) => it.exercise?.name)
        .filter(Boolean) as string[];
      setWorkoutPreviews((prev) => ({ ...prev, [workoutId]: previewNames }));
      const items: SlotItem[] = (w.exercises || []).map((it: any) => ({
        id: it.id,
        exerciseId: it.exercise?.id || it.exerciseId,
        name:
          it.exercise?.name ||
          (it.exerciseId ? "Unknown — use Swap" : "Exercise"),
        sets: it.sets ?? null,
        reps: it.reps ?? null,
        restSec: it.restSec ?? null,
        notes: typeof it.notes === "string" ? it.notes : it.notes ?? null,
        sortOrder: it.sortOrder ?? 0,
      }));
      items.sort((a, b) => a.sortOrder - b.sortOrder);
      const counts = columnSlotCountsForExerciseCount(items.length);
      const total = totalSlotsFromColumnCounts(counts);
      const grid: (SlotItem | null)[] = Array(total).fill(null);
      items.forEach((item, idx) => {
        if (idx < total) grid[idx] = { ...item, sortOrder: idx };
      });
      setColumnSlotCounts(counts);
      setSlots(grid);
      const defaults = rx ?? DEFAULT_DAY_PRESCRIPTION;
      const firstFilled = grid.findIndex((s) => s !== null);
      const firstEmpty = grid.findIndex((s) => s === null);
      const pick = firstFilled >= 0 ? firstFilled : firstEmpty >= 0 ? firstEmpty : 0;
      selectSlot(pick, grid, defaults);
      if (firstFilled >= 0 && grid[firstFilled] && /fasted cardio/i.test(grid[firstFilled].name)) {
        setFastedCardioMinutes(parseFastedCardioMinutes(grid[firstFilled].reps));
      }
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  async function openDayOption(
    day: ProgramDay,
    week: ProgramWeek,
    optIdx: number,
    label: string,
    partIndex = 1,
  ) {
    if (focus && optionNotesDirtyRef.current) {
      await saveOptionNotes({ silent: true });
    }

    let opts = getDayOptions(day, partIndex);
    const optLabel = opts[optIdx]?.label || label;
    const rx = readDayPrescription(day);

    setPrescription(rx);
    setCheckedSlots(new Set());
    setExpandedDays((prev) => new Set(prev).add(day.id));

    if (isDayOffLabel(optLabel)) {
      setFocus({
        dayId: day.id,
        optIdx,
        workoutId: "",
        label: DAY_OFF_LABEL,
        weekNumber: week.weekNumber,
        dayNumber: day.dayNumber,
        partIndex,
      });
      resetSlotGrid();
      setSelectedSlotIdx(null);
      scrollToEditor();
      return;
    }

    const existingWorkoutId = opts[optIdx]?.workoutId || "";
    setFocus({
      dayId: day.id,
      optIdx,
      workoutId: existingWorkoutId,
      label: optLabel,
      weekNumber: week.weekNumber,
      dayNumber: day.dayNumber,
      partIndex,
    });
    scrollToEditor();

    resetSlotGrid();
    setSelectedSlotIdx(0);
    syncEditorFromSlot(null, rx);

    // Only clean flat options on part 1 — multi-part options live under sessions.
    if (partIndex === 1 && dayOptionsNeedCleanup(day)) {
      const cleaned = normalizeDayOptions(day.options || []) as DayOption[];
      void patchDay(day.id, { options: cleaned.map((o) => ({ ...o, partIndex: 1 })) }).then(() => {
        day = { ...day, options: cleaned };
      });
    }

    if (opts.length === 0) {
      // Explicit partIndex — do not rely on focus state (setState is async).
      void setDayOptions(
        day.id,
        [
          { workoutId: "", label: "Gym", partIndex },
          { workoutId: "", label: "Home", partIndex },
        ],
        { silent: true, partIndex },
      );
      opts = [
        { workoutId: "", label: "Gym", partIndex },
        { workoutId: "", label: "Home", partIndex },
      ];
    }

    const ensured = await ensureWorkoutForOption(day.id, optIdx, optLabel, day, partIndex);
    if (!ensured) {
      setMessage("Could not open this day to write — try Refresh, then click the day again.");
      setTimeout(() => setMessage(null), 3500);
      return;
    }
    const { workoutId } = ensured;

    setFocus((prev) =>
      prev?.dayId === day.id && prev.optIdx === optIdx && (prev.partIndex ?? 1) === partIndex
        ? { ...prev, workoutId }
        : prev,
    );

    // Warm-ups are seeded server-side on POST /api/workouts (empty workouts only).
    void loadSlots(workoutId, rx);
  }

  async function clearWorkoutExercises(workoutId: string) {
    const res = await fetch(`/api/workouts/${workoutId}`, { cache: "no-store" });
    if (!res.ok) return;
    const w = await res.json();
    for (const item of w.exercises || []) {
      await fetch(
        `/api/workouts/${workoutId}/exercises?itemId=${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
    }
  }

  async function applyDayOff() {
    if (!focus || !focusDay || !activeWeekData) return;
    const partIndex = focus.partIndex ?? 1;
    setSaving(true);
    try {
      await patchDay(focus.dayId, {
        options: [{ workoutId: "", label: DAY_OFF_LABEL, partIndex }],
        notes: partIndex === 1 ? "Rest day" : undefined,
      });
      setFocus({
        ...focus,
        optIdx: 0,
        workoutId: "",
        label: DAY_OFF_LABEL,
        partIndex,
      });
      resetSlotGrid();
      setCheckedSlots(new Set());
      setSelectedSlotIdx(null);
      setMessage(
        partIndex > 1
          ? `Part ${partIndex} — day off for this session.`
          : "Day Off — rest day.",
      );
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("Could not save day off.");
    } finally {
      setSaving(false);
    }
  }

  async function applyFastedCardio(minutes: number) {
    if (!focus || !focusDay || !activeWeekData) return;
    const cardioEx = library.find((e) => /^fasted cardio$/i.test(e.name));
    if (!cardioEx) {
      setMessage("Add “Fasted Cardio” to the exercise library first.");
      return;
    }

    const partIndex = focus.partIndex ?? 1;
    setSaving(true);
    try {
      const week = program.weeks.find((w) => w.days.some((d) => d.id === focus.dayId));
      const day = week?.days.find((d) => d.id === focus.dayId);
      const cal =
        day?.calendarDate ||
        calendarDateForProgramDay(startMonday, focus.weekNumber, focus.dayNumber);
      const partTag = partIndex > 1 ? ` · Part ${partIndex}` : "";
      const suggestedName = `${program.name} · ${formatShortDate(cal)} ${FASTED_CARDIO_LABEL}${partTag}`;

      let workoutId =
        getDayOptions(day || focusDay, partIndex).find((o) => isFastedCardioLabel(o.label))
          ?.workoutId || "";

      if (!workoutId) {
        const createRes = await fetch("/api/workouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: suggestedName, seedWarmups: false }),
        });
        if (!createRes.ok) {
          setMessage("Could not create fasted cardio workout.");
          return;
        }
        const created = await createRes.json();
        workoutId = created.id as string;
        setAllWorkouts((prev) =>
          prev.some((w) => w.id === workoutId) ? prev : [...prev, { id: workoutId, name: created.name }],
        );
      }

      await patchDay(focus.dayId, {
        options: [{ workoutId, label: FASTED_CARDIO_LABEL, partIndex }],
        notes:
          partIndex === 1 ? `${minutes} minutes fasted cardio` : undefined,
        calendarDate: cal,
      });

      await clearWorkoutExercises(workoutId);

      const addRes = await fetch(`/api/workouts/${workoutId}/exercises`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: cardioEx.id,
          setScheme: "standard",
          repPattern: null,
          reps: fastedCardioReps(minutes),
          sets: 1,
          weightTier: "light",
          restSec: 0,
          notes: `${minutes} min fasted cardio`,
        }),
      });
      if (!addRes.ok) {
        setMessage("Could not add fasted cardio.");
        return;
      }
      const created = await addRes.json();
      if (created.id) {
        await fetch(`/api/workouts/${workoutId}/exercises`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: created.id, sortOrder: 0 }),
        });
      }

      setFastedCardioMinutes(minutes);
      setFocus({
        ...focus,
        optIdx: 0,
        workoutId,
        label: FASTED_CARDIO_LABEL,
        partIndex,
      });
      await loadSlots(workoutId, prescription);
      setMessage(
        partIndex > 1
          ? `Part ${partIndex}: ${minutes} min fasted cardio.`
          : `${minutes} min fasted cardio set.`,
      );
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("Could not save fasted cardio.");
    } finally {
      setSaving(false);
    }
  }

  async function patchExerciseItem(
    itemId: string,
    data: { sets?: number; reps?: string; restSec?: number; notes?: string | null },
  ): Promise<{ ok: boolean; error?: string }> {
    if (!focus) return { ok: false, error: "No day selected." };
    const res = await fetch(`/api/workouts/${focus.workoutId}/exercises`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, ...data }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    const error =
      (typeof body.detail === "string" && body.detail) ||
      (typeof body.error === "string" && body.error) ||
      `Save failed (${res.status})`;
    return { ok: false, error };
  }

  /** Persist one exercise field patch; always use event values for notes to avoid stale React state. */
  async function persistExercisePatch(
    slotIdx: number,
    data: { sets?: number; reps?: string; restSec?: number; notes?: string | null },
  ): Promise<boolean> {
    if (!focus) return false;
    const slot = slots[slotIdx];
    if (!slot) return false;
    const result = await patchExerciseItem(slot.id, data);
    if (!result.ok) {
      setMessage(result.error || "Could not save exercise note.");
      setTimeout(() => setMessage(null), 4000);
      return false;
    }
    setSlots((prev) => {
      const next = [...prev];
      const current = next[slotIdx];
      if (current) {
        next[slotIdx] = {
          ...current,
          ...(data.sets !== undefined ? { sets: data.sets } : {}),
          ...(data.reps !== undefined ? { reps: data.reps } : {}),
          ...(data.restSec !== undefined ? { restSec: data.restSec } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        };
      }
      return next;
    });
    if (data.notes !== undefined && selectedSlotIdx === slotIdx) {
      setEditorNotes(data.notes ?? "");
    }
    return true;
  }

  async function saveSelectedSlot(opts?: {
    manageSaving?: boolean;
    /** Prefer the live input value (blur event) so notes never save empty from a stale render. */
    notesOverride?: string;
    setsOverride?: number;
    repsOverride?: string;
    restOverride?: number;
  }) {
    if (!focus || selectedSlotIdx === null) return;
    const slot = slots[selectedSlotIdx];
    // Notes/sets saves should not flip global `saving` — that disables the note field
    // mid-edit and made it feel like notes couldn't be typed (Jeremy week-2 feedback).
    const manageSaving = opts?.manageSaving === true;

    if (manageSaving) setSaving(true);
    try {
      if (!slot) {
        await patchDay(focus.dayId, {
          defaultSets: editorSets,
          defaultReps: editorReps,
          defaultRestSec: editorRest,
        });
        setPrescription({
          defaultSets: editorSets,
          defaultReps: editorReps,
          defaultRestSec: editorRest,
        });
        return;
      }

      const notesValue = (opts?.notesOverride ?? editorNotes).trim() || null;
      const setsValue = opts?.setsOverride ?? editorSets;
      const repsValue = opts?.repsOverride ?? editorReps;
      const restValue = opts?.restOverride ?? editorRest;
      const ok = await persistExercisePatch(selectedSlotIdx, {
        sets: setsValue,
        reps: repsValue,
        restSec: restValue,
        notes: notesValue,
      });
      if (ok && opts?.notesOverride !== undefined) {
        setMessage("Note saved.");
        setTimeout(() => setMessage(null), 1500);
      }
    } finally {
      if (manageSaving) setSaving(false);
    }
  }

  /** Save note for any row (selected or not) from the input's live value. */
  async function saveSlotNoteFromInput(slotIdx: number, rawNotes: string) {
    if (!focus) return;
    const slot = slots[slotIdx];
    if (!slot) return;
    const notesValue = rawNotes.trim() || null;
    const current = (slot.notes ?? "").trim() || null;
    if (notesValue === current) return;
    const ok = await persistExercisePatch(slotIdx, { notes: notesValue });
    if (ok) {
      setMessage(notesValue ? "Note saved." : "Note cleared.");
      setTimeout(() => setMessage(null), 1500);
    }
  }

  /** Clone all options on this day onto the same weekday next week (always clone workouts). */
  async function pasteDayToNextWeek() {
    if (!focus || !focusDay || !activeWeekData) return;
    const nextWeek = weeks.find((w) => w.weekNumber === activeWeekData.weekNumber + 1);
    if (!nextWeek) {
      setMessage("No next week in this program.");
      setTimeout(() => setMessage(null), 2500);
      return;
    }
    const targetDay = nextWeek.days.find((d) => d.dayNumber === focusDay.dayNumber);
    if (!targetDay) {
      setMessage("Could not find same day next week.");
      return;
    }

    // Include every part (AM/PM military days) — not only the open part.
    const partCount = Math.max(
      1,
      focusDay.partCount ?? daySessions(focusDay).length,
      ...daySessions(focusDay).map((s) => s.partIndex),
    );
    const sourceOpts: DayOption[] = [];
    for (let p = 1; p <= partCount; p++) {
      for (const o of getDayOptions(focusDay, p)) {
        if (!o.workoutId) continue;
        sourceOpts.push({ ...o, partIndex: p });
      }
    }
    if (sourceOpts.length === 0 && !isDayOffLabel(focus.label) && !isFastedCardioLabel(focus.label)) {
      setMessage("Nothing to paste — add Gym/Home workouts first.");
      return;
    }

    setSaving(true);
    try {
      if (isDayOffLabel(focus.label) && sourceOpts.length === 0) {
        await patchDay(targetDay.id, {
          options: [{ workoutId: "", label: DAY_OFF_LABEL, partIndex: 1 }],
          replaceAllOptions: true,
          partCount: 1,
          // Respect auto-clear — don't force “Rest day” text onto every week.
          notes: notesForCopy(focusDay.notes ?? "Rest day"),
          publishedAt: null,
        });
      } else if (isFastedCardioLabel(focus.label) && sourceOpts.length <= 1) {
        // Clone underlying workout if present
        const src = sourceOpts[0];
        if (src?.workoutId) {
          const cloneRes = await fetch(`/api/workouts/${src.workoutId}/clone`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: cloneWorkoutContentName(
                allWorkouts.find((w) => w.id === src.workoutId)?.name || "Fasted cardio",
                FASTED_CARDIO_LABEL,
              ),
            }),
          });
          if (!cloneRes.ok) throw new Error("clone failed");
          const cloned = await cloneRes.json();
          setAllWorkouts((prev) =>
            prev.some((w) => w.id === cloned.id)
              ? prev
              : [...prev, { id: cloned.id, name: cloned.name }],
          );
          await patchDay(targetDay.id, {
            options: [
              {
                workoutId: cloned.id,
                label: FASTED_CARDIO_LABEL,
                trainingLocation: null,
                notes: notesForCopy(src.notes),
                partIndex: 1,
              },
            ],
            replaceAllOptions: true,
            partCount: 1,
            notes: notesForCopy(focusDay.notes),
            publishedAt: null,
          });
        }
      } else {
        const clonedOpts: DayOption[] = [];
        for (const opt of sourceOpts) {
          const cloneRes = await fetch(`/api/workouts/${opt.workoutId}/clone`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: cloneWorkoutContentName(
                allWorkouts.find((w) => w.id === opt.workoutId)?.name || "Workout",
                opt.label,
              ),
            }),
          });
          if (!cloneRes.ok) throw new Error("clone failed");
          const cloned = await cloneRes.json();
          clonedOpts.push({
            workoutId: cloned.id,
            label: opt.label,
            trainingLocation: opt.trainingLocation ?? trainingLocationFromLabel(opt.label),
            notes: notesForCopy(opt.notes),
            partIndex: opt.partIndex ?? 1,
          });
          setAllWorkouts((prev) =>
            prev.some((w) => w.id === cloned.id)
              ? prev
              : [...prev, { id: cloned.id, name: cloned.name }],
          );
          void loadWorkoutPreview(cloned.id);
        }
        await patchDay(targetDay.id, {
          options: clonedOpts,
          replaceAllOptions: true,
          partCount,
          notes: notesForCopy(focusDay.notes),
          publishedAt: null,
        });
      }

      setMessage(
        autoClearNotesOnCopy
          ? `Pasted → next week (clones${partCount > 1 ? `, ${partCount} parts` : ""}, day notes cleared, draft).`
          : `Pasted week ${activeWeekData.weekNumber} day ${focusDay.dayNumber} → week ${nextWeek.weekNumber}${partCount > 1 ? ` (${partCount} parts)` : ""} (clones only).`,
      );
      setTimeout(() => setMessage(null), 4000);
      setActiveWeek(nextWeek.weekNumber);
    } catch {
      setMessage("Could not paste to next week — try again.");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Clone Gym workout → attach as this day's Home (own copy for small edits).
   * Does not change the Gym workout.
   */
  async function copyGymToHome() {
    if (!focusDay || !activeWeekData) return;

    const day = focusDay;
    const partIndex = focus?.dayId === day.id ? (focus.partIndex ?? 1) : 1;
    const refreshed = await ensureGymHomeOptions(day, partIndex);
    const opts = [...getDayOptions(refreshed, partIndex)];
    const gymIdx = opts.findIndex((o) => isGymLabel(o.label));
    const homeIdx = opts.findIndex((o) => isHomeLabel(o.label));
    if (gymIdx < 0 || homeIdx < 0) {
      setMessage("This session needs Gym and Home options first.");
      return;
    }

    const gymId = opts[gymIdx]?.workoutId;
    if (!gymId) {
      setMessage("Build the Gym workout first, then copy it to Home.");
      return;
    }

    // Confirm if Home already has a different populated workout
    const homeId = opts[homeIdx]?.workoutId;
    if (homeId && homeId !== gymId) {
      const homePreview = workoutPreviews[homeId];
      const homeHasContent =
        (homePreview && homePreview.length > 0) ||
        (await (async () => {
          const res = await fetch(`/api/workouts/${homeId}`, { cache: "no-store" });
          if (!res.ok) return false;
          const w = await res.json();
          return Array.isArray(w.exercises) && w.exercises.length > 0;
        })());
      if (homeHasContent) {
        const ok = window.confirm(
          "Home already has a workout. Replace it with a fresh copy of Gym? (Gym is unchanged.)",
        );
        if (!ok) return;
      }
    }

    setSaving(true);
    try {
      const sourceWorkout = allWorkouts.find((w) => w.id === gymId);
      const cloneRes = await fetch(`/api/workouts/${gymId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cloneWorkoutContentName(sourceWorkout?.name || "Unassigned", "Home"),
        }),
      });
      if (!cloneRes.ok) {
        setMessage("Could not copy Gym → Home — try again.");
        return;
      }
      const cloned = (await cloneRes.json()) as { id: string; name: string };

      opts[homeIdx] = {
        workoutId: cloned.id,
        label: "Home",
        trainingLocation: "home",
        notes: opts[homeIdx]?.notes ?? null,
        partIndex,
      };
      await setDayOptions(day.id, opts, { silent: true, partIndex });
      setAllWorkouts((prev) =>
        prev.some((w) => w.id === cloned.id)
          ? prev
          : [...prev, { id: cloned.id, name: cloned.name }],
      );
      void loadWorkoutPreview(cloned.id);

      await openDayOption(refreshed, activeWeekData, homeIdx, "Home", partIndex);
      setMessage(
        partIndex > 1
          ? `Part ${partIndex}: Gym copied to Home — tweak Home only, then Save.`
          : "Gym copied to Home — tweak Home only, then Save.",
      );
      setTimeout(() => setMessage(null), 4000);
    } catch {
      setMessage("Could not copy Gym → Home — try again.");
    } finally {
      setSaving(false);
    }
  }

  function toggleSlotChecked(idx: number, checked: boolean) {
    setCheckedSlots((prev) => {
      const next = new Set(prev);
      if (checked) next.add(idx);
      else next.delete(idx);
      return next;
    });
  }

  function selectAllFilledSlots() {
    const filled = new Set<number>();
    slots.forEach((slot, idx) => {
      if (slot) filled.add(idx);
    });
    setCheckedSlots(filled);
  }

  const filledSlotCount = slots.filter((s) => s !== null).length;

  async function applyToChecked() {
    if (!focus || checkedSlots.size === 0) return;
    setSaving(true);
    try {
      await patchDay(focus.dayId, {
        defaultSets: editorSets,
        defaultReps: editorReps,
        defaultRestSec: editorRest,
      });
      setPrescription({
        defaultSets: editorSets,
        defaultReps: editorReps,
        defaultRestSec: editorRest,
      });

      let applied = 0;
      for (const idx of checkedSlots) {
        const slot = slots[idx];
        if (!slot) continue;
        const result = await patchExerciseItem(slot.id, {
          sets: editorSets,
          reps: editorReps,
          restSec: editorRest,
        });
        if (result.ok) applied++;
      }

      await loadSlots(focus.workoutId, {
        defaultSets: editorSets,
        defaultReps: editorReps,
        defaultRestSec: editorRest,
      });
      setMessage(
        applied > 0 ? `Applied to ${applied} checked exercise(s).` : "Nothing to apply.",
      );
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!focus) {
      setOptionNotes("");
      optionNotesDirtyRef.current = false;
      return;
    }
    const day = program.weeks.flatMap((w) => w.days).find((d) => d.id === focus.dayId);
    if (!day) return;
    const opts = getDayOptions(day, focus.partIndex ?? 1);
    setOptionNotes(opts[focus.optIdx]?.notes ?? "");
    optionNotesDirtyRef.current = false;
  }, [focus?.dayId, focus?.optIdx, focus?.partIndex, program.weeks]);

  useEffect(() => {
    if (!focus?.workoutId) {
      setWorkoutTitle("");
      return;
    }
    const workoutId = focus.workoutId;
    const applyTitle = (rawName: string) => {
      const clean = workoutContentTitle(rawName);
      setWorkoutTitle(clean);
      const persist = repairedStoredWorkoutTitle(rawName);
      // Only persist ID/schedule noise → a real content title. Never write "Workout".
      if (persist) {
          void fetch(`/api/workouts/${workoutId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: persist }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((updated) => {
              if (!updated?.name) return;
              const fixed = workoutContentTitle(updated.name);
              setWorkoutTitle(fixed);
              setAllWorkouts((prev) =>
                prev.map((w) => (w.id === workoutId ? { ...w, name: updated.name } : w)),
              );
            })
            .catch(() => {});
      }
    };

    const cached = allWorkouts.find((w) => w.id === workoutId);
    if (cached) {
      applyTitle(cached.name);
      return;
    }
    fetch(`/api/workouts/${workoutId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.name) applyTitle(data.name);
      })
      .catch(() => {});
  }, [focus?.workoutId, allWorkouts]);

  async function saveOptionNotes(opts?: { silent?: boolean }) {
    if (!focus || savingOptionNotes) return;
    const day = program.weeks.flatMap((w) => w.days).find((d) => d.id === focus.dayId);
    if (!day) return;

    const partIndex = focus.partIndex ?? 1;
    const trimmed = optionNotes.trim();
    const currentOpts = [...getDayOptions(day, partIndex)];
    const stored = currentOpts[focus.optIdx]?.notes ?? "";
    if (trimmed === (stored || "").trim()) {
      optionNotesDirtyRef.current = false;
      return;
    }

    while (currentOpts.length <= focus.optIdx) {
      currentOpts.push({
        workoutId: "",
        label: focus.label || DEFAULT_DAY_OPTIONS[currentOpts.length] || "Gym",
      });
    }
    currentOpts[focus.optIdx] = {
      ...currentOpts[focus.optIdx],
      notes: trimmed || null,
    };

    const silent = opts?.silent === true;
    if (!silent) setSaving(true);
    setSavingOptionNotes(true);
    try {
      await setDayOptions(focus.dayId, currentOpts, { silent: true, partIndex });
      optionNotesDirtyRef.current = false;
      if (!silent) {
        setMessage("Description saved.");
        setTimeout(() => setMessage(null), 1500);
      }
    } catch {
      if (!silent) setMessage("Could not save description.");
    } finally {
      setSavingOptionNotes(false);
      if (!silent) setSaving(false);
    }
  }

  async function saveWorkoutTitle() {
    if (!focus?.workoutId || savingTitle) return;
    const trimmed = workoutTitle.trim();
    if (!trimmed) return;
    setSavingTitle(true);
    try {
      const res = await fetch(`/api/workouts/${focus.workoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        setMessage("Could not save workout title.");
        return;
      }
      const updated = await res.json();
      setAllWorkouts((prev) =>
        prev.map((w) => (w.id === focus.workoutId ? { ...w, name: updated.name } : w)),
      );
      setWorkoutTitle(workoutContentTitle(updated.name));
      setMessage("Workout title saved.");
      setTimeout(() => setMessage(null), 1500);
    } finally {
      setSavingTitle(false);
    }
  }

  async function jumpToEnrollmentDay(dayN: number) {
    const coord = coordinateFromEnrollmentDay(dayN, program.durationWeeks);
    if (!coord) return;
    const week = weeks.find((w) => w.weekNumber === coord.weekNumber);
    const day = week?.days.find((d) => d.dayNumber === coord.dayNumber);
    if (!week || !day) return;
    if (week.weekNumber !== activeWeek) setActiveWeek(week.weekNumber);
    const keepLabel =
      focus && !isDayOffLabel(focus.label) && !isFastedCardioLabel(focus.label)
        ? focus.label
        : "Gym";
    const opts = getDayOptions(day);
    const idx = opts.findIndex((o) => o.label === keepLabel);
    if (idx >= 0) {
      await openDayOption(day, week, idx, opts[idx].label);
      return;
    }
    if (isGymLabel(keepLabel) || isHomeLabel(keepLabel)) {
      const refreshed = await ensureGymHomeOptions(day);
      const optIdx = isHomeLabel(keepLabel) ? 1 : 0;
      await openDayOption(refreshed, week, optIdx, keepLabel);
      return;
    }
    await selectDay(day, week);
  }

  async function selectDay(day: ProgramDay, week: ProgramWeek) {
    const opts = getDayOptions(day);
    if (opts.length === 1 && opts.some((o) => isFastedCardioLabel(o.label))) {
      await openDayOption(day, week, 0, FASTED_CARDIO_LABEL);
      return;
    }
    if (opts.some((o) => isDayOffLabel(o.label))) {
      await openDayOption(day, week, 0, DAY_OFF_LABEL);
      return;
    }
    const gymIdx = opts.findIndex((o) => isGymLabel(o.label));
    await openDayOption(day, week, gymIdx >= 0 ? gymIdx : 0, "Gym");
  }

  /**
   * Jump to a program week and open Mon so the coach can write immediately.
   * Without this, "Jump to week 2" only swapped the grid while the editor stayed
   * on week 1 — felt like week 2 could not be written.
   */
  async function jumpToWeek(weekNumber: number) {
    const week = weeks.find((w) => w.weekNumber === weekNumber);
    if (!week) {
      setMessage(
        `Week ${weekNumber} is not on this program yet. Tap Refresh, or check the program length.`,
      );
      setTimeout(() => setMessage(null), 4000);
      return;
    }
    setActiveWeek(weekNumber);
    const day = [...week.days].sort((a, b) => a.dayNumber - b.dayNumber)[0];
    if (!day) {
      setFocus(null);
      setMessage(`Week ${weekNumber} has no days — tap Refresh.`);
      setTimeout(() => setMessage(null), 3500);
      return;
    }
    await selectDay(day, week);
  }

  const adjacentDayNav = useMemo(() => {
    if (!focus) return { prev: null, next: null };
    const prevCoord = adjacentProgramDay(
      focus.weekNumber,
      focus.dayNumber,
      -1,
      program.durationWeeks,
    );
    const nextCoord = adjacentProgramDay(
      focus.weekNumber,
      focus.dayNumber,
      1,
      program.durationWeeks,
    );
    const resolve = (coord: { weekNumber: number; dayNumber: number } | null) => {
      if (!coord) return null;
      const week = weeks.find((w) => w.weekNumber === coord.weekNumber);
      const day = week?.days.find((d) => d.dayNumber === coord.dayNumber);
      if (!week || !day) return null;
      return { week, day, coord };
    };
    return { prev: resolve(prevCoord), next: resolve(nextCoord) };
  }, [focus, program.durationWeeks, weeks]);

  async function navigateAdjacentDay(delta: -1 | 1) {
    if (!focus || saving) return;
    const target = delta < 0 ? adjacentDayNav.prev : adjacentDayNav.next;
    if (!target) return;

    if (target.week.weekNumber !== activeWeek) {
      setActiveWeek(target.week.weekNumber);
    }

    const targetOpts = getDayOptions(target.day);
    const preferredLabel = isDayOffLabel(focus.label) || isFastedCardioLabel(focus.label)
      ? "Gym"
      : focus.label;
    const matchIdx = targetOpts.findIndex((o) => o.label === preferredLabel);

    if (matchIdx >= 0) {
      await openDayOption(target.day, target.week, matchIdx, targetOpts[matchIdx].label);
      return;
    }

    if (isGymLabel(preferredLabel) || isHomeLabel(preferredLabel)) {
      const refreshed = await ensureGymHomeOptions(target.day);
      const optIdx = isHomeLabel(preferredLabel) ? 1 : 0;
      await openDayOption(refreshed, target.week, optIdx, preferredLabel);
      return;
    }

    await selectDay(target.day, target.week);
  }

  useEffect(() => {
    if (!focus) return;
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const inField = tag === "input" || tag === "textarea" || tag === "select";

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (inField) return;
        e.preventDefault();
        void navigateAdjacentDay(e.key === "ArrowLeft" ? -1 : 1);
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedSlotIdx !== null) {
        if (inField) return;
        const slot = slots[selectedSlotIdx];
        if (!slot) return;
        e.preventDefault();
        void removeSlot(slot.id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focus, saving, adjacentDayNav, selectedSlotIdx, slots, prescription]);

  async function goToCalendarToday() {
    const iso = localTodayIso();
    const match = findProgramDayForCalendarDate(program, iso);
    if (!match) {
      setMessage("Today is before this program calendar starts.");
      setTimeout(() => setMessage(null), 2500);
      return;
    }
    if (match.weekNumber > program.durationWeeks) {
      setMessage("Today is past this program's last week.");
      setTimeout(() => setMessage(null), 2500);
      return;
    }
    const week = weeks.find((w) => w.weekNumber === match.weekNumber);
    const day = week?.days.find((d) => d.dayNumber === match.dayNumber);
    if (!week || !day) {
      setMessage("Could not find today's day on the schedule.");
      setTimeout(() => setMessage(null), 2500);
      return;
    }
    setActiveWeek(match.weekNumber);
    await selectDay(day, week);
    setMessage(`Jumped to today — ${formatShortDate(iso)}.`);
    setTimeout(() => setMessage(null), 2000);
  }

  function mergeDayFromPatch(day: ProgramDay, patch: Record<string, unknown>, updated: any): ProgramDay {
    return {
      ...day,
      ...patch,
      options: (updated.options as DayOption[] | undefined) ?? (patch.options as DayOption[] | undefined) ?? day.options,
      sessions: (updated.sessions as DaySession[] | undefined) ?? day.sessions,
      partCount: (updated.partCount as number | undefined) ?? day.partCount,
      workoutId: (updated.workoutId as string | null | undefined) ?? day.workoutId,
    };
  }

  async function ensureGymHomeOptions(
    day: ProgramDay,
    partIndex = 1,
  ): Promise<ProgramDay> {
    const stored = getDayOptions(day, partIndex);
    const gym = stored.find((o) => isGymLabel(o.label));
    const home = stored.find((o) => isHomeLabel(o.label));

    // workoutId is required in DB — empty shells never persist, so Home never appeared
    // when only Gym existed (Military day 1). Create real empty workouts for missing tracks.
    async function ensureTrackWorkout(
      existingId: string | undefined,
      label: "Gym" | "Home",
    ): Promise<string> {
      if (existingId?.trim()) return existingId;
      const createRes = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:
            partIndex > 1
              ? `${defaultTrackWorkoutTitle(label)} · Part ${partIndex}`
              : defaultTrackWorkoutTitle(label),
        }),
      });
      if (!createRes.ok) {
        throw new Error(`Could not create ${label} workout`);
      }
      const created = (await createRes.json()) as { id: string; name: string };
      setAllWorkouts((prev) =>
        prev.some((w) => w.id === created.id)
          ? prev
          : [...prev, { id: created.id, name: created.name }],
      );
      return created.id;
    }

    let gymId = gym?.workoutId || "";
    let homeId = home?.workoutId || "";
    const needsHome = !home || !homeId;
    const needsGym = !gym || !gymId;
    const needsPatch =
      needsGym ||
      needsHome ||
      stored.some((o) => isDayOffLabel(o.label)) ||
      stored.some((o) => isFastedCardioLabel(o.label));

    if (!needsPatch) {
      return day;
    }

    try {
      if (needsGym) gymId = await ensureTrackWorkout(gymId, "Gym");
      if (needsHome) homeId = await ensureTrackWorkout(homeId, "Home");
    } catch {
      setMessage("Could not open Gym/Home tracks — try Refresh.");
      setTimeout(() => setMessage(null), 3500);
      return day;
    }

    const workoutOpts: DayOption[] = [
      {
        workoutId: gymId,
        label: "Gym",
        trainingLocation: "gym",
        notes: gym?.notes ?? null,
        partIndex,
      },
      {
        workoutId: homeId,
        label: "Home",
        trainingLocation: "home",
        notes: home?.notes ?? null,
        partIndex,
      },
    ];
    const updated = await patchDay(day.id, {
      options: workoutOpts,
      ...(partIndex === 1 ? { notes: null } : {}),
    });
    return mergeDayFromPatch(day, { options: workoutOpts }, updated);
  }

  async function selectDayMode(
    mode: "day-off" | "fasted-cardio" | "gym" | "home" | DayOption,
  ) {
    if (!focus || !focusDay || !activeWeekData) return;
    const partIndex = focus.partIndex ?? 1;

    if (mode === "day-off") {
      await applyDayOff();
      return;
    }
    if (mode === "fasted-cardio") {
      await applyFastedCardio(fastedCardioMinutes);
      return;
    }
    if (mode === "gym" || mode === "home") {
      const label = mode === "gym" ? "Gym" : "Home";
      setSaving(true);
      try {
        const refreshed = await ensureGymHomeOptions(focusDay, partIndex);
        const partOpts = getDayOptions(refreshed, partIndex);
        const optIdx = partOpts.findIndex((o) =>
          mode === "home" ? isHomeLabel(o.label) : isGymLabel(o.label),
        );
        if (optIdx < 0) {
          setMessage(
            mode === "home"
              ? "Home track still missing — hard refresh, then try Home Workout again."
              : "Gym track still missing — hard refresh, then try Gym Workout again.",
          );
          setTimeout(() => setMessage(null), 4000);
          return;
        }
        await openDayOption(refreshed, activeWeekData, optIdx, label, partIndex);
      } finally {
        setSaving(false);
      }
      return;
    }

    const stored = getDayOptions(focusDay, partIndex);
    const idx = stored.findIndex((o) => o.label === mode.label);
    await openDayOption(focusDay, activeWeekData, idx >= 0 ? idx : 0, mode.label, partIndex);
  }

  async function shiftSortOrdersFrom(insertAt: number) {
    if (!focus) return;
    for (let i = slots.length - 1; i >= insertAt; i--) {
      const slot = slots[i];
      if (!slot) continue;
      await fetch(`/api/workouts/${focus.workoutId}/exercises`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: slot.id, sortOrder: i + 1 }),
      });
    }
  }

  async function addSlotBelow(column: number) {
    if (!focus) return;
    const counts = [...columnSlotCounts];
    const indices = slotIndicesForTimeColumn(column, counts);
    const lastIdx = indices[indices.length - 1];
    const lastSlot = slots[lastIdx];

    if (!lastSlot) {
      selectSlot(lastIdx, slots, prescription);
      return;
    }

    const insertAt = lastIdx + 1;
    counts[column]++;
    setColumnSlotCounts(counts);

    const newSlots = [...slots];
    newSlots.splice(insertAt, 0, null);
    setSlots(newSlots);
    setCheckedSlots((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => next.add(i >= insertAt ? i + 1 : i));
      return next;
    });
    selectSlot(insertAt, newSlots, prescription);

    await shiftSortOrdersFrom(insertAt);
    setSlots((prev) =>
      prev.map((s, i) => (s && i > insertAt ? { ...s, sortOrder: i } : s)),
    );
  }

  async function assignSlot(slotIndex: number, exerciseId: string) {
    if (!focus) return;
    setSaving(true);
    const res = await fetch(`/api/workouts/${focus.workoutId}/exercises`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exerciseId,
        setScheme: "standard",
        repPattern: null,
        reps: editorReps,
        sets: editorSets,
        weightTier: "medium",
        restSec: editorRest,
        notes: null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage("Could not add exercise.");
      return;
    }
    const created = await res.json();
    if (created.id) {
      await fetch(`/api/workouts/${focus.workoutId}/exercises`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: created.id, sortOrder: slotIndex }),
      });
    }
    await loadSlots(focus.workoutId, prescription);
    setMessage("Saved.");
    setTimeout(() => setMessage(null), 1500);
  }

  async function removeSlot(itemId: string) {
    if (!focus || saving) return;
    const workoutId = focus.workoutId;
    if (!workoutId) {
      setMessage("No workout loaded — pick Gym/Home first.");
      setTimeout(() => setMessage(null), 2500);
      return;
    }
    const idx = slots.findIndex((s) => s?.id === itemId);
    setSaving(true);
    try {
      const res = await fetch(
        `/api/workouts/${workoutId}/exercises?itemId=${encodeURIComponent(itemId)}`,
        { method: "DELETE", cache: "no-store" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMessage(
          typeof body.detail === "string" ? body.detail : "Could not remove exercise — try again.",
        );
        setTimeout(() => setMessage(null), 3000);
        await loadSlots(workoutId, prescription);
        return;
      }
      if (idx >= 0) {
        setSlots((prev) => {
          const next = [...prev];
          next[idx] = null;
          return next;
        });
        setCheckedSlots((prev) => {
          const next = new Set(prev);
          next.delete(idx);
          return next;
        });
      }
      await loadSlots(workoutId, prescription);
      setMessage("Exercise removed.");
      setTimeout(() => setMessage(null), 1500);
    } finally {
      setSaving(false);
    }
  }

  async function swapSlot(itemId: string, newExerciseId: string) {
    if (!focus) return;
    const slot = slots.find((s) => s?.id === itemId);
    await fetch(`/api/workouts/${focus.workoutId}/exercises`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        exerciseId: newExerciseId,
        reps: slot?.reps || prescription.defaultReps,
        sets: slot?.sets || prescription.defaultSets,
        restSec: slot?.restSec || prescription.defaultRestSec,
      }),
    });
    await loadSlots(focus.workoutId, prescription);
    setMessage("Saved.");
    setTimeout(() => setMessage(null), 1500);
  }

  async function saveDayDraft() {
    if (!focus) return;
    setSaving(true);
    try {
      if (selectedSlotIdx !== null) {
        await saveSelectedSlot({ manageSaving: false });
      }
      await loadSlots(focus.workoutId, prescription);
      setMessage("Saved.");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("Save failed — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function publishDay() {
    if (!focus) return;
    setSaving(true);
    try {
      await patchDay(focus.dayId, { publishedAt: new Date().toISOString() });
      setMessage("Day published — members can see it. You can still edit notes anytime.");
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function unpublishDay() {
    if (!focus) return;
    setSaving(true);
    try {
      await patchDay(focus.dayId, { publishedAt: null });
      setMessage("Unpublished — hidden from members until you Publish again.");
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function attachUploadedWorkoutToFocus(data: Record<string, unknown>) {
    if (!focus) return;
    const workoutId = data.workoutId as string | undefined;
    if (!workoutId) return;

    const week = program.weeks.find((w) => w.weekNumber === focus.weekNumber);
    const day = week?.days.find((d) => d.id === focus.dayId);
    if (!day) return;

    const partIndex = focus.partIndex ?? 1;
    const opts = [...getDayOptions(day, partIndex)];
    while (opts.length <= focus.optIdx) {
      opts.push({
        workoutId: "",
        label: focus.label || DEFAULT_DAY_OPTIONS[opts.length] || "Gym",
        partIndex,
      });
    }
    opts[focus.optIdx] = {
      workoutId,
      label: opts[focus.optIdx]?.label || focus.label,
      trainingLocation: trainingLocationFromLabel(focus.label) ?? opts[focus.optIdx]?.trainingLocation,
      partIndex,
    };

    await setDayOptions(focus.dayId, opts, { silent: true, partIndex });
    const workoutName = (data.workoutName as string) || "Workout";
    setAllWorkouts((prev) =>
      prev.some((w) => w.id === workoutId) ? prev : [...prev, { id: workoutId, name: workoutName }],
    );
    setFocus({ ...focus, workoutId, partIndex });
    await loadSlots(workoutId, prescription);
    void loadWorkoutPreview(workoutId);
    const count = data.exerciseCount as number | undefined;
    setMessage(
      `Upload translation saved${count != null ? ` — ${count} block${count === 1 ? "" : "s"}` : ""} on ${focus.label}${partIndex > 1 ? ` (part ${partIndex})` : ""}.`,
    );
    setTimeout(() => setMessage(null), 3500);
    scrollToEditor();
  }

  function scrollToUploadPanel() {
    requestAnimationFrame(() => {
      uploadPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  async function addCustomOption(dayId: string) {
    const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
    const day = week?.days.find((d) => d.id === dayId);
    if (!day) return;
    const partIndex =
      focus?.dayId === dayId ? (focus.partIndex ?? 1) : 1;
    const opts = [...getDayOptions(day, partIndex)];
    const label = `Setting ${opts.length + 1}`;
    opts.push({ workoutId: "", label, partIndex });
    await setDayOptions(dayId, opts, { partIndex });
  }

  async function copyWeek(
    fromWeekNumber: number,
    toWeekNumber: number,
    opts?: { manageSaving?: boolean; fromProgramWeeks?: ProgramWeek[] },
  ) {
    const manageSaving = opts?.manageSaving !== false;
    const sourceWeeks = opts?.fromProgramWeeks ?? program.weeks;
    const fromWeek = sourceWeeks.find((w) => w.weekNumber === fromWeekNumber);
    const toWeek = program.weeks.find((w) => w.weekNumber === toWeekNumber);
    if (!fromWeek || !toWeek) return false;

    if (manageSaving) {
      setSaving(true);
      setMessage(`Copying week ${fromWeekNumber} → week ${toWeekNumber}…`);
    }

    try {
      for (const toDay of [...toWeek.days].sort((a, b) => a.dayNumber - b.dayNumber)) {
        const fromDay = fromWeek.days.find((d) => d.dayNumber === toDay.dayNumber);
        if (!fromDay) continue;

        const partCount = Math.max(
          1,
          fromDay.partCount ?? daySessions(fromDay).length,
          ...daySessions(fromDay).map((s) => s.partIndex),
        );
        // Collect Gym/Home (etc.) from every part so multi-part military days copy fully.
        const fromOpts: DayOption[] = [];
        for (let p = 1; p <= partCount; p++) {
          for (const o of getDayOptions(fromDay, p)) {
            if (!o.workoutId) continue;
            fromOpts.push({ ...o, partIndex: p });
          }
        }
        const toCal =
          toDay.calendarDate ||
          calendarDateForProgramDay(startMonday, toWeekNumber, toDay.dayNumber);

        // Day description: always set (null when auto-clear) so leftovers never stick.
        const clearedDayNotes = notesForCopy(fromDay.notes);

        if (fromOpts.length === 0) {
          // Also clear rest/empty days — wipe every track + description.
          await patchDay(toDay.id, {
            options: [],
            replaceAllOptions: true,
            calendarDate: toCal,
            partCount: 1,
            publishedAt: null,
            notes: clearedDayNotes,
            videoUrl: null,
          });
          continue;
        }

        const clonedOpts: DayOption[] = [];
        for (const opt of fromOpts) {
          const sourceWorkout = allWorkouts.find((w) => w.id === opt.workoutId);
          const cloneRes = await fetch(`/api/workouts/${opt.workoutId}/clone`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: cloneWorkoutContentName(sourceWorkout?.name || "", opt.label),
            }),
          });
          if (!cloneRes.ok) {
            if (manageSaving) setMessage("Copy failed — try again.");
            return false;
          }
          const cloned = await cloneRes.json();
          clonedOpts.push({
            workoutId: cloned.id,
            label: opt.label,
            trainingLocation:
              opt.trainingLocation ?? trainingLocationFromLabel(opt.label),
            // Explicit null when auto-clear — do not omit the field.
            notes: notesForCopy(opt.notes),
            partIndex: opt.partIndex ?? 1,
          });
          setAllWorkouts((prev) =>
            prev.some((w) => w.id === cloned.id) ? prev : [...prev, { id: cloned.id, name: cloned.name }],
          );
        }

        // Never copy publishedAt — target week stays a draft so coach can edit
        // day descriptions (e.g. "Welcome Day one…") before publishing again.
        // replaceAllOptions: wipe leftover multi-part tracks so old Day descriptions cannot remain.
        const dayPatch: Record<string, unknown> = {
          options: clonedOpts,
          replaceAllOptions: true,
          calendarDate: toCal,
          videoUrl: fromDay.videoUrl ?? null,
          publishedAt: null,
          notes: clearedDayNotes,
          partCount,
        };
        if (fromDay.defaultSets != null) dayPatch.defaultSets = fromDay.defaultSets;
        if (fromDay.defaultReps != null) dayPatch.defaultReps = fromDay.defaultReps;
        if (fromDay.defaultRestSec != null) dayPatch.defaultRestSec = fromDay.defaultRestSec;
        await patchDay(toDay.id, dayPatch);
      }

      // Refresh focused Day description field if it still points at a day we may have overwritten.
      optionNotesDirtyRef.current = false;
      setOptionNotes("");

      return true;
    } catch {
      if (manageSaving) setMessage("Copy failed — try again.");
      return false;
    } finally {
      if (manageSaving) setSaving(false);
    }
  }

  async function copyWeekToThisWeek() {
    if (activeWeek <= 1) return;
    const targetWeek = activeWeek;
    const ok = await copyWeek(activeWeek - 1, targetWeek);
    if (ok) {
      await sync();
      await jumpToWeek(targetWeek);
      setMessage(
        autoClearNotesOnCopy
          ? `Week ${targetWeek} copied — independent workouts, draft, day notes cleared. Write new notes, then Publish.`
          : `Week ${targetWeek} copied — independent workouts, draft (not published). Edit day notes, then Publish when ready.`,
      );
      setTimeout(() => setMessage(null), 4500);
    }
  }

  /** Load another program's week and clone it into the week you're viewing (Adult → Military, etc.). */
  async function importWeekFromOtherProgram() {
    if (!importSourceSlug || importSourceSlug === program.slug) {
      setMessage("Pick a different program to import from.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    setImportBusy(true);
    setSaving(true);
    setMessage(
      `Importing ${importSourceSlug} week ${importSourceWeek} → this program week ${activeWeek}…`,
    );
    try {
      const res = await fetch(`/api/programs/${encodeURIComponent(importSourceSlug)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setMessage("Could not load source program — try again.");
        return;
      }
      const source = (await res.json()) as Program;
      const maxW = source.durationWeeks || source.weeks?.length || 1;
      setImportSourceMaxWeek(maxW);
      const fromWeekNum = Math.min(importSourceWeek, maxW);
      const ok = await copyWeek(fromWeekNum, activeWeek, {
        manageSaving: false,
        fromProgramWeeks: source.weeks as ProgramWeek[],
      });
      if (ok) {
        await sync();
        await jumpToWeek(activeWeek);
        setMessage(
          `Imported ${source.name || importSourceSlug} week ${fromWeekNum} → week ${activeWeek} (clones only). Edit, then Publish.`,
        );
        setTimeout(() => setMessage(null), 5000);
      }
    } catch {
      setMessage("Import failed — try again.");
      setTimeout(() => setMessage(null), 3500);
    } finally {
      setImportBusy(false);
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!importSourceSlug || importSourceSlug === program.slug) return;
    let cancelled = false;
    void fetch(`/api/programs/${encodeURIComponent(importSourceSlug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Program | null) => {
        if (cancelled || !data) return;
        const maxW = data.durationWeeks || data.weeks?.length || 1;
        setImportSourceMaxWeek(maxW);
        setImportSourceWeek((w) => Math.min(w, maxW));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [importSourceSlug, program.slug]);

  /** Copy the week you're viewing into the next week (clone workouts). */
  async function copyCurrentWeekToNext() {
    const from = activeWeekData.weekNumber;
    const to = from + 1;
    if (to > program.durationWeeks) {
      setMessage(`No week ${to} — this program only has ${program.durationWeeks} weeks.`);
      setTimeout(() => setMessage(null), 3500);
      return;
    }
    const ok = await copyWeek(from, to);
    if (ok) {
      await sync();
      await jumpToWeek(to);
      setMessage(
        autoClearNotesOnCopy
          ? `Copied week ${from} → week ${to} (notes cleared on target). Edit, then Publish.`
          : `Copied week ${from} → week ${to}. Independent workouts, draft until you Publish.`,
      );
      setTimeout(() => setMessage(null), 4500);
    }
  }

  /** Save Mon–Sun of the open week into the Template Library as a week pack. */
  async function postCurrentWeekToLibrary() {
    const weekNumber = activeWeekData.weekNumber;
    const defaultName = `${program.name} · Week ${weekNumber}`;
    const name = window.prompt(
      "Name for this week pack in the Template Library:",
      defaultName,
    );
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setMessage("Name required to post week pack.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    setSaving(true);
    setMessage(`Saving week ${weekNumber} to Template Library…`);
    try {
      const res = await fetch("/api/workout-cycles/week-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug: program.slug,
          weekNumber,
          name: trimmed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.message || data.detail || "Could not save week pack.");
        setTimeout(() => setMessage(null), 4500);
        return;
      }
      setMessage(
        `Posted “${trimmed}” to Template Library (week pack). Paste it from Templates & paste → Week packs.`,
      );
      setTimeout(() => setMessage(null), 5000);
    } catch {
      setMessage("Could not save week pack — try again.");
      setTimeout(() => setMessage(null), 3500);
    } finally {
      setSaving(false);
    }
  }

  async function copyWeekToRemaining(fromWeekNumber: number) {
    const later = [...program.weeks]
      .filter((w) => w.weekNumber > fromWeekNumber)
      .sort((a, b) => a.weekNumber - b.weekNumber);
    if (later.length === 0) return;

    setSaving(true);
    setMessage(`Copying week ${fromWeekNumber} to weeks ${later.map((w) => w.weekNumber).join(", ")}…`);
    try {
      for (const week of later) {
        const ok = await copyWeek(fromWeekNumber, week.weekNumber, { manageSaving: false });
        if (!ok) {
          setMessage("Copy failed — try again.");
          return;
        }
      }
      await sync();
      setMessage(
        autoClearNotesOnCopyRef.current
          ? `Week ${fromWeekNumber} copied to all remaining weeks (day notes cleared).`
          : `Week ${fromWeekNumber} copied to all remaining weeks.`,
      );
      setTimeout(() => setMessage(null), 3500);
    } finally {
      setSaving(false);
    }
  }

  /** Snap Week 1 Monday to a date and rewrite every day.calendarDate (fixes stale June labels in July). */
  async function reanchorCalendar(startDateIso: string) {
    setSaving(true);
    setMessage("Updating program calendar dates…");
    try {
      const res = await fetch(`/api/programs/${program.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: startDateIso, reanchorCalendar: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.detail || "Could not update calendar dates.");
        setTimeout(() => setMessage(null), 4000);
        return;
      }
      if (data.weeks) {
        setProgram((prev) => ({
          ...prev,
          ...data,
          startDate: data.startDate ?? startDateIso,
          weeks: data.weeks,
        }));
      } else {
        await sync();
        setProgram((prev) => ({ ...prev, startDate: startDateIso }));
      }
      setMessage(
        `Calendar re-anchored to week of ${formatShortDate(toIsoDate(mondayOfWeek(parseIsoDate(startDateIso))))}. Day labels now use the new dates.`,
      );
      setTimeout(() => setMessage(null), 5000);
    } catch {
      setMessage("Could not update calendar dates — try again.");
      setTimeout(() => setMessage(null), 3500);
    } finally {
      setSaving(false);
    }
  }

  async function duplicateToTargets() {
    if (!focus) return;
    const sourceDay = program.weeks.flatMap((w) => w.days).find((d) => d.id === focus.dayId);
    if (!sourceDay) return;

    const sourceOpts = getDayOptions(sourceDay).filter((o) => o.workoutId);
    if (sourceOpts.length === 0) {
      setMessage("Nothing to duplicate — add exercises first.");
      return;
    }

    setSaving(true);
    let copied = 0;
    for (const targetId of duplicateTargets) {
      if (targetId === focus.dayId) continue;
      const targetDay = program.weeks.flatMap((w) => w.days).find((d) => d.id === targetId);
      const targetWeek = program.weeks.find((w) => w.days.some((d) => d.id === targetId));
      if (!targetDay || !targetWeek) continue;

      const cal =
        targetDay.calendarDate ||
        calendarDateForProgramDay(startMonday, targetWeek.weekNumber, targetDay.dayNumber);
      const clonedOpts: DayOption[] = [];

      for (const opt of sourceOpts) {
        const sourceWorkout = allWorkouts.find((w) => w.id === opt.workoutId);
        const cloneRes = await fetch(`/api/workouts/${opt.workoutId}/clone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: cloneWorkoutContentName(sourceWorkout?.name || "", opt.label),
          }),
        });
        if (!cloneRes.ok) continue;
        const cloned = await cloneRes.json();
        clonedOpts.push({
          workoutId: cloned.id,
          label: opt.label,
          notes: notesForCopy(opt.notes),
        });
        setAllWorkouts((prev) =>
          prev.some((w) => w.id === cloned.id) ? prev : [...prev, { id: cloned.id, name: cloned.name }],
        );
      }

      if (clonedOpts.length > 0) {
        await patchDay(targetId, {
          options: clonedOpts,
          replaceAllOptions: true,
          defaultSets: sourceDay.defaultSets ?? prescription.defaultSets,
          defaultReps: sourceDay.defaultReps ?? prescription.defaultReps,
          defaultRestSec: sourceDay.defaultRestSec ?? prescription.defaultRestSec,
          calendarDate: cal,
          notes: notesForCopy(sourceDay.notes),
          publishedAt: null,
        });
        copied++;
      }
    }

    setSaving(false);
    setShowDuplicate(false);
    setDuplicateTargets(new Set());
    setMessage(
      autoClearNotesOnCopy
        ? `Copied to ${copied} day(s) — own workout copies, day notes cleared.`
        : `Copied to ${copied} day(s). Each has its own workout copy.`,
    );
    setTimeout(() => setMessage(null), 3000);
    await sync();
  }

  const focusDay = focus
    ? program.weeks.flatMap((w) => w.days).find((d) => d.id === focus.dayId)
    : null;

  async function persistSlotOrder(grid: (SlotItem | null)[]) {
    if (!focus) return;
    setSaving(true);
    try {
      const patches: Promise<Response>[] = [];
      for (let i = 0; i < grid.length; i++) {
        const slot = grid[i];
        if (!slot) continue;
        if ((slot.sortOrder ?? i) !== i) {
          patches.push(
            fetch(`/api/workouts/${focus.workoutId}/exercises`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ itemId: slot.id, sortOrder: i }),
            }),
          );
        }
      }
      if (patches.length > 0) {
        await Promise.all(patches);
        await loadSlots(focus.workoutId, prescription);
        setMessage("Saved.");
        setTimeout(() => setMessage(null), 1500);
      }
    } finally {
      setSaving(false);
    }
  }

  function countFilledSlots() {
    return slots.filter((s) => s !== null).length;
  }

  function reorderFilledSlots(fromIdx: number, toIdx: number) {
    if (!slots[fromIdx]) return null;
    const filled = countFilledSlots();
    const clampedTo = Math.max(0, Math.min(toIdx, Math.max(0, filled - 1)));
    if (fromIdx === clampedTo) return [...slots];

    const next = [...slots];
    const item = next[fromIdx]!;
    if (fromIdx < clampedTo) {
      for (let i = fromIdx; i < clampedTo; i++) next[i] = next[i + 1] ?? null;
    } else {
      for (let i = fromIdx; i > clampedTo; i--) next[i] = next[i - 1] ?? null;
    }
    next[clampedTo] = item;
    return next;
  }

  async function moveSlot(fromIdx: number, toIdx: number) {
    if (!focus || !slots[fromIdx]) return;
    const next = reorderFilledSlots(fromIdx, toIdx);
    if (!next) return;
    setSlots(next);
    setDragOverIdx(null);
    await persistSlotOrder(next);
    setMessage("Order updated.");
    setTimeout(() => setMessage(null), 1200);
  }

  async function moveSlotByDirection(idx: number, direction: -1 | 1) {
    if (!slots[idx]) return;
    const filled = countFilledSlots();
    const positions = slots
      .map((s, i) => (s ? i : -1))
      .filter((i) => i >= 0);
    const pos = positions.indexOf(idx);
    if (pos < 0) return;
    const targetPos = pos + direction;
    if (targetPos < 0 || targetPos >= filled) return;
    await moveSlot(idx, positions[targetPos]!);
  }

  function renderExerciseSlot(idx: number) {
    const slot = slots[idx];
    const isSelected = selectedSlotIdx === idx;
    const isChecked = checkedSlots.has(idx);

    const filled = countFilledSlots();
    const filledPositions = slots.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
    const posInList = filledPositions.indexOf(idx);
    const canMoveUp = slot != null && posInList > 0;
    const canMoveDown = slot != null && posInList >= 0 && posInList < filled - 1;
    const isDropTarget = dragOverIdx === idx && dragFromIdx.current !== null;

    const noteDisplayValue = isSelected ? editorNotes : slot?.notes ?? "";

    return (
      <div
        key={idx}
        className={`flex items-start gap-1.5 rounded-md border px-2 py-1.5 transition ${
          isDropTarget
            ? "border-sky-400 bg-sky-500/15 ring-1 ring-sky-400/50"
            : isChecked
              ? "border-emerald-400 bg-emerald-500/20"
              : isSelected
                ? "border-accent bg-accent/10"
                : "border-[var(--border)] bg-[var(--surface-2)] hover:border-accent/30"
        } ${slot && !saving ? "cursor-grab active:cursor-grabbing" : ""}`}
        draggable={!!slot && !saving}
        onDragStart={(e) => {
          if (!slot) return;
          // Don't start drag from form fields (breaks typing notes)
          const t = e.target as HTMLElement;
          if (t.closest("input, textarea, select, button, a, [role='listbox']")) {
            e.preventDefault();
            return;
          }
          dragFromIdx.current = idx;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(idx));
        }}
        onDragEnd={() => {
          dragFromIdx.current = null;
          setDragOverIdx(null);
        }}
        onDragOver={(e) => {
          if (dragFromIdx.current === null || dragFromIdx.current === idx) return;
          e.preventDefault();
          setDragOverIdx(idx);
        }}
        onDragLeave={() => {
          if (dragOverIdx === idx) setDragOverIdx(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const from =
            dragFromIdx.current ??
            (Number.isFinite(Number(e.dataTransfer.getData("text/plain")))
              ? Number(e.dataTransfer.getData("text/plain"))
              : null);
          dragFromIdx.current = null;
          setDragOverIdx(null);
          if (from !== null && from !== idx) void moveSlot(from, idx);
        }}
      >
        {slot ? (
          <>
            <span
              className="mt-1 shrink-0 select-none text-[10px] text-[var(--muted)]"
              title="Drag row to reorder"
              aria-hidden
            >
              ⠿
            </span>
            <div className="mt-0.5 flex shrink-0 flex-col gap-0.5">
              <button
                type="button"
                className="rounded px-0.5 text-[9px] leading-none text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:opacity-25"
                disabled={saving || !canMoveUp}
                title="Move up"
                aria-label={`Move ${slot.name} up`}
                onClick={(e) => {
                  e.stopPropagation();
                  void moveSlotByDirection(idx, -1);
                }}
              >
                ▲
              </button>
              <button
                type="button"
                className="rounded px-0.5 text-[9px] leading-none text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:opacity-25"
                disabled={saving || !canMoveDown}
                title="Move down"
                aria-label={`Move ${slot.name} down`}
                onClick={(e) => {
                  e.stopPropagation();
                  void moveSlotByDirection(idx, 1);
                }}
              >
                ▼
              </button>
            </div>
            <input
              type="checkbox"
              className="mt-1.5 h-3.5 w-3.5 shrink-0"
              checked={isChecked}
              onChange={(e) => toggleSlotChecked(idx, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
            {/* Not a <button> — nested inputs inside buttons break typing (Safari / Jeremy notes). */}
            <div className="min-w-0 flex-1 space-y-1">
              <button
                type="button"
                className="block w-full truncate text-left text-xs font-medium hover:text-accent"
                onClick={() => selectSlot(idx, slots, prescription)}
              >
                <span className={/unknown/i.test(slot.name) ? "text-amber-300" : ""}>
                  {slot.name}
                </span>
              </button>
              <div className="flex flex-wrap items-center gap-1 text-[10px]">
                {isSelected ? (
                  <>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="input h-6 w-10 px-1 text-[10px]"
                      value={editorSets}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v)) setEditorSets(Math.max(1, v));
                      }}
                      onFocus={() => selectSlot(idx, slots, prescription)}
                      onBlur={() => void saveSelectedSlot()}
                      aria-label={`Sets for ${slot.name}`}
                    />
                    <span className="text-[var(--muted)]">×</span>
                    <input
                      className="input h-6 w-14 px-1 text-[10px]"
                      value={editorReps}
                      onChange={(e) => setEditorReps(e.target.value)}
                      onFocus={() => selectSlot(idx, slots, prescription)}
                      onBlur={() => void saveSelectedSlot()}
                      aria-label={`Reps for ${slot.name}`}
                    />
                    {slot.restSec != null ? (
                      <span className="text-[var(--muted)]">· {slot.restSec}s rest</span>
                    ) : null}
                  </>
                ) : (
                  <button
                    type="button"
                    className="text-left text-[10px] text-[var(--muted)] hover:text-[var(--text)]"
                    onClick={() => selectSlot(idx, slots, prescription)}
                  >
                    {slot.sets ?? prescription.defaultSets} × {slot.reps ?? prescription.defaultReps}
                    {slot.restSec != null ? ` · ${slot.restSec}s` : ""}
                    <span className="ml-1 text-accent/80">· edit sets</span>
                  </button>
                )}
              </div>
              <label className="block">
                <span className="sr-only">Coach note for {slot.name}</span>
                <input
                  type="text"
                  className="input h-8 w-full min-w-0 border-violet-500/30 bg-violet-500/5 px-2 text-xs text-violet-100 placeholder:text-violet-200/40"
                  value={noteDisplayValue}
                  placeholder="Note for this exercise (members see this)…"
                  maxLength={500}
                  onFocus={() => {
                    if (!isSelected) selectSlot(idx, slots, prescription);
                  }}
                  onChange={(e) => {
                    if (!isSelected) selectSlot(idx, slots, prescription);
                    setEditorNotes(e.target.value);
                  }}
                  onBlur={(e) => {
                    void saveSlotNoteFromInput(idx, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  aria-label={`Coach note for ${slot.name}`}
                />
              </label>
            </div>
            <div className="mt-0.5 w-24 shrink-0">
              <SearchableExerciseSelect
                library={library}
                value=""
                placeholder="Swap"
                disabled={saving}
                onChange={(id) => void swapSlot(slot.id, id)}
              />
            </div>
            <button
              type="button"
              className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/10"
              title="Remove exercise (Delete)"
              aria-label={`Remove ${slot.name}`}
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void removeSlot(slot.id);
              }}
            >
              ×
            </button>
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            <div className="min-w-0 flex-1" onClick={() => selectSlot(idx, slots, prescription)}>
              <SearchableExerciseSelect
                library={library}
                value=""
                placeholder={`+ slot ${idx + 1}`}
                disabled={saving}
                onChange={(id) => void assignSlot(idx, id)}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  const week1MondayIso = toIsoDate(startMonday);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span>
          Week 1 starts{" "}
          <strong className="text-[var(--text)]">{formatShortDate(week1MondayIso)}</strong>
          {" · "}
          Mon-anchored design calendar
        </span>
        <div className="flex gap-1">
          <Link href="/admin/exercises" className="btn-ghost px-2 py-0.5 text-[10px]">
            Library
          </Link>
          <button type="button" className="btn-ghost px-2 py-0.5 text-[10px]" onClick={() => void sync()}>
            Refresh
          </button>
        </div>
      </div>

      {anchorIsStale ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="font-semibold text-amber-100">Calendar still on an older week</p>
            <p className="text-[11px] text-amber-100/80">
              Week 1 is {formatShortDate(week1MondayIso)}
              {program.startDate ? ` (saved start ${program.startDate})` : ""}. Today is{" "}
              {formatShortDate(localTodayIso())} — day chips may still say last month until you
              re-anchor.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary px-3 py-1.5 text-xs font-semibold"
              disabled={saving}
              onClick={() => void reanchorCalendar(thisWeekMondayIso)}
              title={`Set Week 1 Monday to ${formatShortDate(thisWeekMondayIso)} and refresh every day label`}
            >
              Use this week ({formatShortDate(thisWeekMondayIso)})
            </button>
            <label className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
              Or pick Monday
              <input
                type="date"
                className="input h-8 w-auto text-xs"
                disabled={saving}
                defaultValue={thisWeekMondayIso}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) void reanchorCalendar(v);
                }}
              />
            </label>
          </div>
        </div>
      ) : null}

      {message && <p className="text-sm text-[var(--success)]">{message}</p>}

      {contentAlert && (
        <ProgramContentReadinessBanner
          alert={contentAlert}
          onJumpToWeek={(weekNumber) => void jumpToWeek(weekNumber)}
          onTextUpload={scrollToUploadPanel}
          onCopyPrevWeek={async (toWeek, fromWeek) => {
            const ok = await copyWeek(fromWeek, toWeek);
            if (ok) {
              await sync();
              await jumpToWeek(toWeek);
              setMessage(`Week ${fromWeek} copied to week ${toWeek} — edit below.`);
              setTimeout(() => setMessage(null), 3500);
            }
          }}
          onCopyWeek1Remaining={async () => {
            await copyWeekToRemaining(1);
            await jumpToWeek(2);
          }}
        />
      )}

      <div ref={uploadPanelRef}>
        <TextUploadPanel
          mode="program-week"
          programSlug={program.slug}
          weekNumber={activeWeek}
          weekOptions={weeks.map((w) => w.weekNumber)}
          panelId="upload-translation-week"
          collapsible
          defaultOpen={false}
          onBuilt={async () => {
            await sync();
            setMessage(`Week ${activeWeek} updated from upload translation.`);
            setTimeout(() => setMessage(null), 3500);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[var(--muted)]">Jump to week</span>
        {weeks.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              activeWeek === w.weekNumber
                ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                : attentionWeeks.has(w.weekNumber)
                  ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/50"
                  : "bg-[var(--surface-2)] text-[var(--muted)]"
            }`}
            onClick={() => void jumpToWeek(w.weekNumber)}
          >
            Week {w.weekNumber}
            {attentionWeeks.has(w.weekNumber) && !contentAlert?.readiness.isCurrentWithClients ? " ⚠" : ""}
          </button>
        ))}
        {calendarToday && calendarToday.weekNumber <= program.durationWeeks && (
          <button
            type="button"
            className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent hover:bg-accent/20"
            onClick={() => void goToCalendarToday()}
          >
            Today ({formatShortDate(calendarToday.iso)})
          </button>
        )}
      </div>

      {activeWeekData && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">
              Week {activeWeekData.weekNumber}
              <span className="ml-2 text-sm font-normal text-[var(--muted)]">
                {formatMonthYear(
                  calendarDateForProgramDay(startMonday, activeWeekData.weekNumber, 1),
                )}
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <label
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[10px] text-[var(--muted)]"
                title="When checked, copy/duplicate/paste clears Day description so week 2 does not keep “Welcome Day one…” notes"
              >
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={autoClearNotesOnCopy}
                  disabled={saving}
                  onChange={(e) => setAutoClearNotesOnCopyPersist(e.target.checked)}
                />
                <span className="font-medium text-[var(--text)]">Auto-clear notes on copy</span>
              </label>
              <button
                type="button"
                className="btn-primary text-xs font-semibold"
                disabled={saving || activeWeekData.weekNumber >= program.durationWeeks}
                onClick={() => void copyCurrentWeekToNext()}
                title={
                  activeWeekData.weekNumber >= program.durationWeeks
                    ? "Already on the last week"
                    : `Clone this week’s Mon–Sun into week ${activeWeekData.weekNumber + 1}`
                }
              >
                Copy current week
                {activeWeekData.weekNumber < program.durationWeeks
                  ? ` → W${activeWeekData.weekNumber + 1}`
                  : ""}
              </button>
              <button
                type="button"
                className="btn-ghost text-xs font-semibold ring-1 ring-violet-400/50"
                disabled={saving}
                onClick={() => void postCurrentWeekToLibrary()}
                title="Save this week’s Mon–Sun (Gym/Home clones) into the Template Library as a week pack"
              >
                Post current week to Template Library
              </button>
              {activeWeekData.weekNumber > 1 && (
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  disabled={saving}
                  onClick={() => void copyWeekToThisWeek()}
                  title={`Clone week ${activeWeekData.weekNumber - 1} into week ${activeWeekData.weekNumber}, then edit`}
                >
                  Copy from week {activeWeekData.weekNumber - 1}
                </button>
              )}
              {activeWeekData.weekNumber === 1 && program.durationWeeks > 1 && (
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  disabled={saving}
                  onClick={() => void copyWeekToRemaining(1)}
                >
                  Copy to all remaining weeks
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2">
              <p className="w-full text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                Import week from another program
              </p>
              <label className="text-[10px] text-[var(--muted)]">
                From program
                <select
                  className="input mt-0.5 block h-8 min-w-[10rem] text-xs"
                  value={importSourceSlug}
                  disabled={saving || importBusy}
                  onChange={(e) => setImportSourceSlug(e.target.value)}
                >
                  {[
                    { slug: "adult", name: "Adult" },
                    { slug: "strength-training", name: "Athletes" },
                    { slug: "boot-camp-preparation", name: "Military" },
                    { slug: "mom-dads-little-time", name: "Mom & Dads" },
                  ]
                    .filter((p) => p.slug !== program.slug)
                    .map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-[10px] text-[var(--muted)]">
                Source week
                <select
                  className="input mt-0.5 block h-8 w-20 text-xs"
                  value={importSourceWeek}
                  disabled={saving || importBusy}
                  onChange={(e) => setImportSourceWeek(Number(e.target.value))}
                >
                  {Array.from({ length: importSourceMaxWeek }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      W{n}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-primary h-8 px-3 text-xs font-semibold"
                disabled={saving || importBusy}
                onClick={() => void importWeekFromOtherProgram()}
                title={`Clone ${importSourceSlug} week ${importSourceWeek} into this program week ${activeWeek}`}
              >
                {importBusy
                  ? "Importing…"
                  : `Import → this week (W${activeWeek})`}
              </button>
            </div>
          </div>

          <p className="mb-2 text-[11px] text-[var(--muted)]">
            Click a day (Mon–Sun) to write or edit its Gym/Home workout.{" "}
            <strong className="text-[var(--text)]">Copy current week</strong> seeds the next week;{" "}
            <strong className="text-[var(--text)]">Import from another program</strong> pulls Adult /
            Athletes / etc. into Military;{" "}
            <strong className="text-[var(--text)]">Post to Template Library</strong> saves a reusable
            week pack.
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {[...activeWeekData.days]
              .sort((a, b) => a.dayNumber - b.dayNumber)
              .map((day) => {
                const cal =
                  // Prefer live anchor math so labels follow startDate (not a stale stamped June date).
                  calendarDateForProgramDay(startMonday, activeWeekData.weekNumber, day.dayNumber);
                const isSelected = focus?.dayId === day.id;
                const isExpanded = expandedDays.has(day.id);
                const published = !!day.publishedAt;
                const enrollmentDay = linearEnrollmentDay(
                  activeWeekData.weekNumber,
                  day.dayNumber,
                );
                const dayPreview = previewForDay(day, activeWeekData.weekNumber);
                const isCalendarToday = cal === toIsoDate(new Date());

                return (
                  <button
                    key={day.id}
                    type="button"
                    className={`${dayGridCardClasses(isSelected, published)} ${
                      isCalendarToday && !isSelected && !published
                        ? "ring-1 ring-sky-400/50"
                        : ""
                    }`}
                    onClick={() => void selectDay(day, activeWeekData)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold leading-none ${dayGridTextClass(isSelected, published, "title")}`}>
                          {formatCycleDayFromWeekDay(activeWeekData.weekNumber, day.dayNumber)}
                        </p>
                        <p className={`text-[10px] leading-none ${dayGridTextClass(isSelected, published, "meta")}`}>
                          {DAY_LABELS[day.dayNumber - 1]}
                        </p>
                        <p className={`mt-0.5 text-[10px] ${dayGridTextClass(isSelected, published, "meta")}`}>
                          {formatShortDate(cal)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-bold leading-none ${dayGridTextClass(isSelected, published, "title")}`}
                        aria-hidden
                      >
                        {isExpanded ? "▼" : "▶"}
                      </span>
                    </div>
                    <p className={`mt-1 text-[10px] ${dayGridTextClass(isSelected, published, "meta")}`}>
                      {dayKindLabel(day)}
                      {published && (
                        <span className="font-bold text-emerald-200"> · Published</span>
                      )}
                    </p>
                    {dayPreview && (
                      <p
                        className={`mt-0.5 truncate text-[9px] ${dayGridTextClass(isSelected, published, "meta")}`}
                        title={dayPreview}
                      >
                        {dayPreview}
                      </p>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {focus && focusDay && (
        <div
          ref={editorRef}
          className={`space-y-2 rounded-lg border p-3 scroll-mt-4 ${
            focusDay.publishedAt
              ? "border-2 border-emerald-500/60 bg-emerald-950/25"
              : "border-accent/25 bg-[var(--surface)]"
          }`}
        >
          {focusDay.publishedAt && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-emerald-500/50 bg-emerald-950/50 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-base font-extrabold text-emerald-950">
                  ✓
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold tracking-wide text-emerald-300">
                    Published — live for members
                  </p>
                  <p className="text-[10px] text-emerald-400/90">
                    Green means members can see this day. You can still edit the day description,
                    title, and exercises. Use Unpublish to hide it from members.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost shrink-0 px-2 py-1 text-xs text-emerald-200"
                disabled={saving}
                title="Hide this day from members until you publish again"
                onClick={() => void unpublishDay()}
              >
                Unpublish
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div
                className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5"
                role="navigation"
                aria-label="Program day"
              >
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={saving || !adjacentDayNav.prev}
                  aria-label="Previous day"
                  onClick={() => void navigateAdjacentDay(-1)}
                >
                  ‹
                </button>
                <div className="min-w-[8rem] px-1 text-center">
                  <label className="sr-only" htmlFor="program-day-select">
                    Program day
                  </label>
                  <select
                    id="program-day-select"
                    className="input w-full py-1 text-center text-sm font-semibold"
                    value={focusEnrollmentDay ?? 1}
                    disabled={saving}
                    onChange={(e) => void jumpToEnrollmentDay(Number(e.target.value))}
                  >
                    {Array.from({ length: cycleDays }, (_, i) => i + 1).map((dayN) => (
                      <option key={dayN} value={dayN}>
                        {cycleDayKeyFromLinear(dayN)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                    {DAY_LABELS[focus.dayNumber - 1]}
                    <span className="text-sky-300">
                      {" "}
                      · {formatCycleDayFromWeekDay(focus.weekNumber, focus.dayNumber)}
                    </span>
                    {formatTrainingLocationLabel(trainingLocationFromLabel(focus.label)) && (
                      <span className="text-violet-300">
                        {" "}
                        · {formatTrainingLocationLabel(trainingLocationFromLabel(focus.label))}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={saving || !adjacentDayNav.next}
                  aria-label="Next day"
                  onClick={() => void navigateAdjacentDay(1)}
                >
                  ›
                </button>
              </div>
              {focusDay.publishedAt && (
                <span className="inline-flex items-center rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/40">
                  ✓ Published
                </span>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {focus.workoutId && !isDayOffLabel(focus.label) && !isFastedCardioLabel(focus.label) && (
                <label className="flex min-w-[10rem] flex-1 items-center gap-1.5 text-[10px] text-[var(--muted)]">
                  <span className="shrink-0">Title</span>
                  <input
                    className="input min-w-0 flex-1 py-1 text-xs text-[var(--text)]"
                    value={workoutTitle}
                    disabled={saving || savingTitle}
                    placeholder="e.g. Full body"
                    onChange={(e) => setWorkoutTitle(e.target.value)}
                    onBlur={() => void saveWorkoutTitle()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void saveWorkoutTitle();
                      }
                    }}
                  />
                </label>
              )}
              {focus.workoutId && (
                <>
                  {workoutPreviews[focus.workoutId]?.length > 0 && (
                    <span
                      className="max-w-[200px] truncate text-[10px] text-[var(--muted)]"
                      title={workoutPreviews[focus.workoutId].join(" · ")}
                    >
                      {workoutPreviews[focus.workoutId].join(" · ")}
                    </span>
                  )}
                  <Link
                    href={`/admin/workouts/${focus.workoutId}`}
                    className="text-[10px] text-accent hover:underline"
                  >
                    Edit workout →
                  </Link>
                  <Link
                    href={(() => {
                      const cal =
                        focusDay?.calendarDate ||
                        calendarDateForProgramDay(startMonday, focus.weekNumber, focus.dayNumber);
                      const params = new URLSearchParams({
                        program: program.slug,
                        workoutId: focus.workoutId,
                        date: cal,
                      });
                      if (focus.label) params.set("option", focus.label);
                      return `/member/workout?${params.toString()}`;
                    })()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[var(--muted)] hover:text-accent hover:underline"
                  >
                    Member view
                  </Link>
                </>
              )}
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs"
                disabled={saving}
                title="Save draft — members only see this day after you Publish"
                onClick={() => void saveDayDraft()}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {focusDay.publishedAt ? (
                <button
                  type="button"
                  className="rounded-md border-2 border-emerald-500/60 bg-emerald-950/40 px-2 py-1 text-xs font-extrabold text-emerald-300"
                  disabled={saving}
                  title="Already live for members — click Unpublish in the banner to hide"
                  onClick={() => void unpublishDay()}
                >
                  ✓ Published · Unpublish?
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary px-2 py-1 text-xs"
                  disabled={saving}
                  title="Mark this day ready for members"
                  onClick={() => void publishDay()}
                >
                  Publish
                </button>
              )}
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs"
                disabled={saving}
                onClick={() => setShowDuplicate(true)}
              >
                Duplicate…
              </button>
            </div>
          </div>

          {/* Multi-part day (military double/triple): sessions before Gym/Home tracks */}
          <div className="space-y-2 rounded-md border border-dashed border-sky-500/30 bg-sky-500/5 px-2 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-200/90">
                Day parts
              </span>
              {([1, 2, 3] as const).map((n) => {
                const active = (focusDay.partCount ?? daySessions(focusDay).length ?? 1) === n;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={saving}
                    className={
                      active
                        ? "rounded-full bg-sky-500/30 px-2.5 py-1 text-[10px] font-bold text-sky-100 ring-1 ring-sky-400/50"
                        : "rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] text-[var(--muted)] hover:text-[var(--text)]"
                    }
                    onClick={() => void setDayPartCount(focus.dayId, n)}
                    title={
                      n === 1
                        ? "Single session day"
                        : n === 2
                          ? "Double day — AM + PM"
                          : "Triple day — AM + midday (e.g. cardio) + PM"
                    }
                  >
                    {n === 1 ? "1 part" : n === 2 ? "2 parts" : "3 parts"}
                  </button>
                );
              })}
            </div>
            {(focusDay.partCount ?? 1) > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {daySessions(focusDay).map((s) => {
                  const active = (focus.partIndex ?? 1) === s.partIndex;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={saving}
                      className={
                        active
                          ? "rounded-md bg-violet-500/30 px-2.5 py-1.5 text-[11px] font-bold text-violet-100 ring-1 ring-violet-400/50"
                          : "rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] text-[var(--muted)] hover:border-violet-400/40 hover:text-[var(--text)]"
                      }
                      onClick={() => {
                        const week = program.weeks.find((w) => w.weekNumber === focus.weekNumber);
                        if (!week) return;
                        void openDayOption(focusDay, week, 0, "Gym", s.partIndex);
                      }}
                    >
                      Part {s.partIndex}
                      <span className="ml-1 font-normal opacity-80">
                        · {s.label}
                        {s.sessionKind && s.sessionKind !== "strength"
                          ? ` (${s.sessionKind})`
                          : ""}
                      </span>
                    </button>
                  );
                })}
                <p className="w-full text-[10px] text-[var(--muted)]">
                  Each part has its own workout (and Gym/Home tracks). Middle part of a 3-part day
                  defaults to cardio (e.g. fasted cardio).
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={beanButtonClass(isDayOffLabel(focus.label))}
              disabled={saving}
              onClick={() => void selectDayMode("day-off")}
            >
              Day Off
            </button>
            <button
              type="button"
              className={beanButtonClass(isFastedCardioLabel(focus.label))}
              disabled={saving}
              onClick={() => void selectDayMode("fasted-cardio")}
            >
              Fasted cardio
            </button>
            <label className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
              <input
                type="number"
                min={5}
                max={120}
                step={5}
                className="input h-6 w-11 px-1 text-center text-[10px]"
                value={fastedCardioMinutes}
                disabled={saving}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) setFastedCardioMinutes(Math.max(5, Math.min(120, v)));
                }}
                onBlur={() => {
                  if (isFastedCardioLabel(focus.label)) void applyFastedCardio(fastedCardioMinutes);
                }}
              />
              min
            </label>
            <button
              type="button"
              className={beanButtonClass(isGymLabel(focus.label))}
              disabled={saving}
              onClick={() => void selectDayMode("gym")}
            >
              Gym Workout
            </button>
            <button
              type="button"
              className={beanButtonClass(isHomeLabel(focus.label))}
              disabled={saving}
              onClick={() => void selectDayMode("home")}
            >
              Home Workout
            </button>
            {(isGymLabel(focus.label) || isHomeLabel(focus.label) || isWorkoutDayLabel(focus.label)) && (
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs font-semibold text-violet-200"
                disabled={saving}
                title="Clone Gym exercises into a new Home workout on this day, then edit Home only"
                onClick={() => void copyGymToHome()}
              >
                Copy Gym → Home
              </button>
            )}
            {focus && focusDay && !isDayOffLabel(focus.label) && (
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs font-semibold text-violet-200"
                disabled={saving}
                title="Clone this day's Gym/Home (and options) to the same weekday next week"
                onClick={() => void pasteDayToNextWeek()}
              >
                Paste → same day next week
              </button>
            )}
            {customSettingOptions(focusDay).map((opt) => (
              <button
                key={opt.label}
                type="button"
                className={beanButtonClass(focus.label === opt.label)}
                disabled={saving}
                onClick={() => void selectDayMode(opt)}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              className="rounded-full border border-dashed border-[var(--border)] px-2.5 py-1 text-[10px] font-medium text-accent hover:border-accent/50 hover:bg-accent/10"
              disabled={saving}
              onClick={() => void addCustomOption(focus.dayId)}
            >
              + Add More
            </button>
          </div>

          {focus.workoutId &&
            !isDayOffLabel(focus.label) &&
            !isFastedCardioLabel(focus.label) && (
              <label className="block px-1">
                <span className="text-[10px] font-medium text-[var(--muted)]">
                  Day description
                  {formatTrainingLocationLabel(trainingLocationFromLabel(focus.label)) && (
                    <span className="text-violet-300">
                      {" "}
                      ({formatTrainingLocationLabel(trainingLocationFromLabel(focus.label))})
                    </span>
                  )}
                </span>
                <textarea
                  className="input mt-1 min-h-[4.5rem] w-full resize-y py-2 text-xs"
                  value={optionNotes}
                  disabled={saving || savingOptionNotes}
                  placeholder="Notes for this day only — e.g. Welcome to week 2… Edit anytime, even after Publish"
                  onChange={(e) => {
                    setOptionNotes(e.target.value);
                    optionNotesDirtyRef.current = true;
                  }}
                  onBlur={() => void saveOptionNotes({ silent: true })}
                />
              </label>
            )}

          {!isDayOffLabel(focus.label) && !isFastedCardioLabel(focus.label) && (
            <TextUploadPanel
              mode="workout"
              collapsible
              defaultOpen={false}
              redirectToWorkout={false}
              onBuilt={(data) => void attachUploadedWorkoutToFocus(data)}
            />
          )}

          <ProgramTemplatePastePanel
            programSlug={program.slug}
            dayId={focus.dayId}
            partIndex={focus.partIndex ?? 1}
            activeWeekNumber={activeWeekData.weekNumber}
            durationWeeks={program.durationWeeks}
            focusWorkoutId={focus.workoutId || null}
            focusWorkoutLabel={
              focus.workoutId
                ? workoutContentTitle(
                    allWorkouts.find((w) => w.id === focus.workoutId)?.name || workoutTitle,
                  )
                : workoutTitle || undefined
            }
            disabled={saving}
            onMessage={(m) => {
              setMessage(m);
              setTimeout(() => setMessage(null), 4000);
            }}
            onPasted={async (result) => {
              // Reload full tree (GET now works; sync is fallback), then open the new clones.
              // Without this, paste wrote to DB but the editor kept the old empty workout —
              // Jeremy saw “kicked back / not saving” on Military multi-part days.
              const fresh = await reloadProgramTree();
              const dayId = result?.dayId || focus?.dayId;
              const partIndex = result?.partIndex ?? focus?.partIndex ?? 1;
              if (!dayId) return;

              const tree = fresh || program;
              let week: ProgramWeek | undefined;
              let day: ProgramDay | undefined;
              for (const w of tree.weeks || []) {
                const d = w.days.find((x) => x.id === dayId);
                if (d) {
                  week = w;
                  day = d;
                  break;
                }
              }
              if (!week || !day) {
                if (focus?.workoutId) void loadSlots(focus.workoutId, prescription);
                return;
              }

              const opts = getDayOptions(day, partIndex);
              const preferHome =
                (focus && isHomeLabel(focus.label) && result?.homeWorkoutId) ||
                (!result?.gymWorkoutId && Boolean(result?.homeWorkoutId));
              let optIdx = preferHome
                ? opts.findIndex((o) => isHomeLabel(o.label))
                : opts.findIndex((o) => isGymLabel(o.label));
              if (optIdx < 0) optIdx = opts.findIndex((o) => Boolean(o.workoutId));
              if (optIdx < 0) optIdx = 0;
              const label = opts[optIdx]?.label || (preferHome ? "Home" : "Gym");
              await openDayOption(day, week, optIdx, label, partIndex);
            }}
          />

          {isDayOffLabel(focus.label) ? (
              <p className="rounded-md bg-[var(--surface-2)] px-3 py-4 text-center text-sm text-[var(--muted)]">
                Rest day — no workout. Tap <strong>Gym Workout</strong> or <strong>Home Workout</strong>{" "}
                above.
              </p>
            ) : isFastedCardioLabel(focus.label) ? (
              <div className="space-y-1 px-2 py-2">
                <div className="flex flex-wrap items-end gap-2 rounded-md bg-[var(--surface)] px-2 py-1.5">
                  <p className="mr-1 text-[10px] text-[var(--muted)]">Fasted cardio</p>
                  <label className="text-[10px]">
                    Minutes
                    <input
                      className="input mt-0.5 h-7 w-14 px-1 text-xs"
                      value={String(fastedCardioMinutes)}
                      disabled={saving}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v)) setFastedCardioMinutes(Math.max(5, Math.min(120, v)));
                      }}
                      onBlur={() => void applyFastedCardio(fastedCardioMinutes)}
                    />
                  </label>
                </div>
                {loadingSlots ? (
                  <p className="text-xs text-[var(--muted)]">Loading…</p>
                ) : slots[0] ? (
                  renderExerciseSlot(0)
                ) : (
                  <p className="text-xs text-[var(--muted)]">
                    Tap <strong>Fasted cardio</strong> above to assign minutes.
                  </p>
                )}
              </div>
            ) : isGymLabel(focus.label) || isHomeLabel(focus.label) || isWorkoutDayLabel(focus.label) ? (
              <div className="space-y-1">
                <div className="flex flex-wrap items-end gap-2 rounded-md bg-[var(--surface)] px-2 py-1.5">
                  <p className="mr-1 max-w-[160px] truncate text-[10px] font-semibold text-violet-200">
                    {focus.label} workout
                  </p>
                  <p className="mr-1 max-w-[120px] truncate text-[10px] text-[var(--muted)]">
                    {selectedSlotIdx !== null && slots[selectedSlotIdx]
                      ? slots[selectedSlotIdx]!.name
                      : "Select exercise"}
                  </p>
                  <label className="text-[10px]">
                    Sets
                    <input
                      ref={setsInputRef}
                      type="number"
                      min={1}
                      max={20}
                      className="input mt-0.5 h-7 w-12 px-1 text-xs"
                      value={editorSets}
                      disabled={selectedSlotIdx === null}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v)) setEditorSets(Math.max(1, v));
                      }}
                      onBlur={() => void saveSelectedSlot()}
                    />
                  </label>
                  <label className="text-[10px]">
                    Reps
                    <input
                      className="input mt-0.5 h-7 w-14 px-1 text-xs"
                      value={editorReps}
                      disabled={selectedSlotIdx === null}
                      onChange={(e) => setEditorReps(e.target.value)}
                      onBlur={() => void saveSelectedSlot()}
                    />
                  </label>
                  <label className="text-[10px]">
                    Rest
                    <input
                      type="number"
                      min={0}
                      max={600}
                      className="input mt-0.5 h-7 w-12 px-1 text-xs"
                      value={editorRest}
                      disabled={selectedSlotIdx === null}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v)) setEditorRest(Math.max(0, v));
                      }}
                      onBlur={() => void saveSelectedSlot()}
                    />
                  </label>
                  <label className="min-w-[12rem] flex-1 text-[10px]">
                    Coach note (same as field under each exercise)
                    <input
                      className="input mt-0.5 h-7 w-full min-w-[10rem] border-violet-500/30 px-1.5 text-xs text-violet-100"
                      value={editorNotes}
                      disabled={
                        selectedSlotIdx === null || !slots[selectedSlotIdx ?? -1]
                      }
                      placeholder="e.g. light band · skip if knees hurt"
                      maxLength={500}
                      onChange={(e) => setEditorNotes(e.target.value)}
                      onBlur={(e) => {
                        if (selectedSlotIdx === null) return;
                        void saveSlotNoteFromInput(selectedSlotIdx, e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-ghost h-7 px-2 text-[10px]"
                    disabled={saving || filledSlotCount === 0}
                    onClick={() => selectAllFilledSlots()}
                  >
                    Select all ({filledSlotCount})
                  </button>
                  <button
                    type="button"
                    className="btn-ghost h-7 px-2 text-[10px]"
                    disabled={saving || checkedSlots.size === 0}
                    onClick={() => void applyToChecked()}
                  >
                    Apply to checked ({checkedSlots.size})
                  </button>
                </div>

                <p className="text-[10px] text-[var(--muted)]">
                  Each exercise has a{" "}
                  <strong className="text-violet-200/90">violet note field</strong> always visible —
                  type a cue for members, then click away (auto-saves). Sets/reps: click the
                  exercise name · Gym→Home clones · Delete removes · drag handle or ▲▼ to reorder.
                </p>

                {loadingSlots ? (
                  <p className="text-xs text-[var(--muted)]">Loading…</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {Array.from({ length: DAY_TIME_BLOCK_COUNT }, (_, col) => (
                      <div key={col} className="space-y-1">
                        <p className="border-b border-[var(--border)] pb-1 text-[10px] font-semibold uppercase tracking-wide text-accent/80">
                          {timeBlockLabel(col)}
                        </p>
                        {slotIndicesForTimeColumn(col, columnSlotCounts).map((idx) =>
                          renderExerciseSlot(idx),
                        )}
                        <button
                          type="button"
                          className="w-full rounded-md border border-dashed border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted)] transition hover:border-accent/50 hover:text-accent"
                          disabled={saving}
                          onClick={() => void addSlotBelow(col)}
                        >
                          + Add below
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-md bg-[var(--surface-2)] px-3 py-4 text-center text-sm text-[var(--muted)]">
                Tap <strong>Gym Workout</strong> or <strong>Home Workout</strong> above to build this day.
              </p>
            )}
        </div>
      )}

      {!focus && (
        <p className="text-xs text-[var(--muted)]">Click a day to edit.</p>
      )}

      {showDuplicate && focus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl">
            <h3 className="font-semibold">Assign this workout to other program days</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Pick cycle days (M1D1, M1D2, … M1D28). Each target gets its own copy — title,
              location, and cycle day stay separate.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: cycleDays }, (_, i) => i + 1).map((dayN) => {
                const coord = coordinateFromEnrollmentDay(dayN, program.durationWeeks);
                if (!coord) return null;
                const week = program.weeks.find((w) => w.weekNumber === coord.weekNumber);
                const day = week?.days.find((d) => d.dayNumber === coord.dayNumber);
                if (!day) return null;
                const checked = duplicateTargets.has(day.id);
                const isSource = day.id === focus.dayId;
                return (
                  <label
                    key={day.id}
                    className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-xs ${
                      checked ? "border-accent bg-accent/10" : "border-[var(--border)]"
                    } ${isSource ? "opacity-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isSource}
                      onChange={(e) => {
                        setDuplicateTargets((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(day.id);
                          else next.delete(day.id);
                          return next;
                        });
                      }}
                    />
                    <span>
                      {cycleDayKeyFromLinear(dayN)}
                      <span className="ml-1 text-[var(--muted)]">
                        {DAY_LABELS[coord.dayNumber - 1]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn-primary"
                disabled={saving || duplicateTargets.size === 0}
                onClick={() => void duplicateToTargets()}
              >
                Copy to {duplicateTargets.size} day(s)
              </button>
              <button type="button" className="btn-ghost" onClick={() => setShowDuplicate(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseIsoMonth(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return { year: y, month: (m || 1) - 1 };
}