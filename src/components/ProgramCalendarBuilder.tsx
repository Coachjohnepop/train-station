"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SearchableExerciseSelect, {
  type LibraryExercise,
} from "@/components/SearchableExerciseSelect";
import { DAY_LABELS } from "@/lib/program-constants";
import {
  calendarDateForProgramDay,
  columnSlotCountsForExerciseCount,
  daysInMonth,
  DEFAULT_COLUMN_SLOT_COUNTS,
  DEFAULT_DAY_OPTIONS,
  formatMonthYear,
  formatShortDate,
  DAY_OFF_LABEL,
  DEFAULT_FASTED_CARDIO_MINUTES,
  FASTED_CARDIO_LABEL,
  fastedCardioReps,
  isDayOffLabel,
  isFastedCardioLabel,
  isGymLabel,
  isHomeLabel,
  isWorkoutDayLabel,
  normalizeDayOptions,
  parseFastedCardioMinutes,
  resolveProgramStartMonday,
  slotIndicesForTimeColumn,
  timeBlockLabel,
  findProgramDayForCalendarDate,
  localTodayIso,
  toIsoDate,
  totalSlotsFromColumnCounts,
  DAY_TIME_BLOCK_COUNT,
  WARMUP_EXERCISE_NAMES,
} from "@/lib/program-calendar";
import {
  DEFAULT_DAY_PRESCRIPTION,
  readDayPrescription,
  type DayPrescription,
} from "@/lib/program-day-prescription";

type WorkoutOption = { id: string; name: string };

type DayOption = { workoutId: string; label: string };

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
  sortOrder: number;
};

type Focus = {
  dayId: string;
  optIdx: number;
  workoutId: string;
  label: string;
  weekNumber: number;
  dayNumber: number;
};

function getDayOptions(day: ProgramDay): DayOption[] {
  if (day.options && day.options.length > 0) {
    return normalizeDayOptions(day.options) as DayOption[];
  }
  if (day.workoutId) return [{ workoutId: day.workoutId, label: "Gym" }];
  return [];
}

function dayKindLabel(day: ProgramDay): string {
  const opts = getDayOptions(day);
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
function customSettingOptions(day: ProgramDay): DayOption[] {
  return getDayOptions(day).filter(
    (o) =>
      !isGymLabel(o.label) &&
      !isHomeLabel(o.label) &&
      !isDayOffLabel(o.label) &&
      !isFastedCardioLabel(o.label),
  );
}

function beanButtonClass(active: boolean): string {
  return active
    ? "rounded-full border border-emerald-400 bg-emerald-500/25 px-2.5 py-1 text-[10px] font-bold text-emerald-100 ring-1 ring-emerald-400/60"
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
  return highlighted ? "text-emerald-100/80" : "text-[var(--muted)]";
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
}: {
  program: Program;
  workouts: WorkoutOption[];
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
  const [fastedCardioMinutes, setFastedCardioMinutes] = useState(DEFAULT_FASTED_CARDIO_MINUTES);
  const [workoutPreviews, setWorkoutPreviews] = useState<Record<string, string[]>>({});

  const startMonday = useMemo(
    () => resolveProgramStartMonday(program.startDate),
    [program.startDate],
  );

  const weeks = useMemo(
    () => [...program.weeks].sort((a, b) => a.weekNumber - b.weekNumber),
    [program.weeks],
  );

  const activeWeekData = weeks.find((w) => w.weekNumber === activeWeek) || weeks[0];

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

  function previewForDay(day: ProgramDay): string | null {
    for (const opt of getDayOptions(day)) {
      const names = opt.workoutId ? workoutPreviews[opt.workoutId] : undefined;
      if (names?.length) return names.join(" · ");
    }
    return null;
  }

  async function patchDay(dayId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/programs/days/${dayId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Day save failed");
    const updated = await res.json();
    setProgram((prev) => ({
      ...prev,
      weeks: prev.weeks.map((w) => ({
        ...w,
        days: w.days.map((d) =>
          d.id === dayId
            ? {
                ...d,
                ...patch,
                options: updated.options ?? d.options,
                workoutId: updated.workoutId ?? d.workoutId,
              }
            : d,
        ),
      })),
    }));
    return updated;
  }

  async function setDayOptions(dayId: string, options: DayOption[], opts?: { silent?: boolean }) {
    const silent = opts?.silent === true;
    if (!silent) setSaving(true);
    try {
      await patchDay(dayId, { options: normalizeDayOptions(options) as DayOption[] });
      if (!silent) {
        setMessage("Saved.");
        setTimeout(() => setMessage(null), 1500);
      }
    } catch {
      if (!silent) setMessage("Could not save — try again.");
    } finally {
      if (!silent) setSaving(false);
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

  async function ensureWorkoutForOption(
    dayId: string,
    optIdx: number,
    label: string,
    dayOverride?: ProgramDay,
  ): Promise<string | null> {
    const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
    const day = dayOverride ?? week?.days.find((d) => d.id === dayId);
    if (!week || !day) return null;

    const opts = [...getDayOptions(day)];
    if (opts[optIdx]?.workoutId) return opts[optIdx].workoutId;

    const cal =
      day.calendarDate ||
      calendarDateForProgramDay(startMonday, week.weekNumber, day.dayNumber);
    const suggestedName = `${program.name} · ${formatShortDate(cal)} ${label}`;

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

    await setDayOptions(dayId, opts, { silent: true });
    setAllWorkouts((prev) =>
      prev.some((w) => w.id === created.id) ? prev : [...prev, { id: created.id, name: created.name }],
    );

    if (!day.calendarDate) {
      await patchDay(dayId, { calendarDate: cal });
    }

    return created.id as string;
  }

  async function seedWarmups(workoutId: string, rx: DayPrescription) {
    const res = await fetch(`/api/workouts/${workoutId}`);
    if (!res.ok) return;
    const w = await res.json();
    const existing = (w.exercises || []) as Array<{ exercise?: { name?: string } }>;
    const existingNames = new Set(existing.map((e) => e.exercise?.name?.toLowerCase()));

    for (let i = 0; i < WARMUP_EXERCISE_NAMES.length; i++) {
      const targetName = WARMUP_EXERCISE_NAMES[i];
      if (existingNames.has(targetName.toLowerCase())) continue;
      const ex = library.find((e) => e.name.toLowerCase() === targetName.toLowerCase());
      if (!ex) continue;
      await fetch(`/api/workouts/${workoutId}/exercises`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: ex.id,
          setScheme: "standard",
          repPattern: null,
          reps: rx.defaultReps,
          sets: rx.defaultSets,
          weightTier: "light",
          restSec: rx.defaultRestSec,
          notes: i === 0 ? "Warm-up" : "Mobility warm-up",
        }),
      });
    }
  }

  function syncEditorFromSlot(slot: SlotItem | null, rx: DayPrescription) {
    if (slot) {
      setEditorSets(slot.sets ?? rx.defaultSets);
      setEditorReps(slot.reps ?? rx.defaultReps);
      setEditorRest(slot.restSec ?? rx.defaultRestSec);
    } else {
      setEditorSets(rx.defaultSets);
      setEditorReps(rx.defaultReps);
      setEditorRest(rx.defaultRestSec);
    }
  }

  function selectSlot(idx: number, grid: (SlotItem | null)[], rx: DayPrescription) {
    setSelectedSlotIdx(idx);
    syncEditorFromSlot(grid[idx], rx);
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
        name: it.exercise?.name || "Exercise",
        sets: it.sets ?? null,
        reps: it.reps ?? null,
        restSec: it.restSec ?? null,
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

  async function openDayOption(day: ProgramDay, week: ProgramWeek, optIdx: number, label: string) {
    let opts = getDayOptions(day);
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
    });
    scrollToEditor();

    if (existingWorkoutId) {
      void loadSlots(existingWorkoutId, rx);
    } else {
      resetSlotGrid();
      setSelectedSlotIdx(0);
      syncEditorFromSlot(null, rx);
    }

    if (dayOptionsNeedCleanup(day)) {
      const cleaned = normalizeDayOptions(day.options || []) as DayOption[];
      void patchDay(day.id, { options: cleaned }).then(() => {
        day = { ...day, options: cleaned };
      });
    }

    if (opts.length === 0) {
      void setDayOptions(
        day.id,
        [
          { workoutId: "", label: "Gym" },
          { workoutId: "", label: "Home" },
        ],
        { silent: true },
      );
      opts = [
        { workoutId: "", label: "Gym" },
        { workoutId: "", label: "Home" },
      ];
    }

    const workoutId = await ensureWorkoutForOption(day.id, optIdx, optLabel, day);
    if (!workoutId) return;

    setFocus((prev) =>
      prev?.dayId === day.id && prev.optIdx === optIdx ? { ...prev, workoutId } : prev,
    );

    void loadSlots(workoutId, rx);
    if (isWorkoutDayLabel(optLabel)) {
      void seedWarmups(workoutId, rx).then(() => loadSlots(workoutId, rx));
    }
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
    setSaving(true);
    try {
      await patchDay(focus.dayId, {
        options: [{ workoutId: "", label: DAY_OFF_LABEL }],
        notes: "Rest day",
      });
      setFocus({
        ...focus,
        optIdx: 0,
        workoutId: "",
        label: DAY_OFF_LABEL,
      });
      resetSlotGrid();
      setCheckedSlots(new Set());
      setSelectedSlotIdx(null);
      setMessage("Day Off — rest day.");
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

    setSaving(true);
    try {
      const week = program.weeks.find((w) => w.days.some((d) => d.id === focus.dayId));
      const day = week?.days.find((d) => d.id === focus.dayId);
      const cal =
        day?.calendarDate ||
        calendarDateForProgramDay(startMonday, focus.weekNumber, focus.dayNumber);
      const suggestedName = `${program.name} · ${formatShortDate(cal)} ${FASTED_CARDIO_LABEL}`;

      let workoutId =
        getDayOptions(day || focusDay).find((o) => isFastedCardioLabel(o.label))?.workoutId || "";

      if (!workoutId) {
        const createRes = await fetch("/api/workouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: suggestedName }),
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
        options: [{ workoutId, label: FASTED_CARDIO_LABEL }],
        notes: `${minutes} minutes fasted cardio`,
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
      });
      await loadSlots(workoutId, prescription);
      setMessage(`${minutes} min fasted cardio set.`);
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("Could not save fasted cardio.");
    } finally {
      setSaving(false);
    }
  }

  async function patchExerciseItem(
    itemId: string,
    data: { sets?: number; reps?: string; restSec?: number },
  ) {
    if (!focus) return false;
    const res = await fetch(`/api/workouts/${focus.workoutId}/exercises`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, ...data }),
    });
    return res.ok;
  }

  async function saveSelectedSlot() {
    if (!focus || selectedSlotIdx === null) return;
    const slot = slots[selectedSlotIdx];

    setSaving(true);
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

      const ok = await patchExerciseItem(slot.id, {
        sets: editorSets,
        reps: editorReps,
        restSec: editorRest,
      });
      if (ok) {
        setSlots((prev) => {
          const next = [...prev];
          const current = next[selectedSlotIdx];
          if (current) {
            next[selectedSlotIdx] = {
              ...current,
              sets: editorSets,
              reps: editorReps,
              restSec: editorRest,
            };
          }
          return next;
        });
      } else {
        setMessage("Could not save exercise.");
      }
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
        const ok = await patchExerciseItem(slot.id, {
          sets: editorSets,
          reps: editorReps,
          restSec: editorRest,
        });
        if (ok) applied++;
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
      workoutId: (updated.workoutId as string | null | undefined) ?? day.workoutId,
    };
  }

  async function ensureGymHomeOptions(day: ProgramDay): Promise<ProgramDay> {
    const stored = getDayOptions(day);
    const gym = stored.find((o) => isGymLabel(o.label));
    const home = stored.find((o) => isHomeLabel(o.label));
    const workoutOpts: DayOption[] = [
      { workoutId: gym?.workoutId || "", label: "Gym" },
      { workoutId: home?.workoutId || "", label: "Home" },
    ];
    const needsPatch =
      !gym ||
      !home ||
      stored.some((o) => isDayOffLabel(o.label)) ||
      stored.some((o) => isFastedCardioLabel(o.label));
    if (!needsPatch) return { ...day, options: workoutOpts };
    const updated = await patchDay(day.id, { options: workoutOpts, notes: null });
    return mergeDayFromPatch(day, { options: workoutOpts, notes: null }, updated);
  }

  async function selectDayMode(
    mode: "day-off" | "fasted-cardio" | "gym" | "home" | DayOption,
  ) {
    if (!focus || !focusDay || !activeWeekData) return;

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
      const refreshed = await ensureGymHomeOptions(focusDay);
      const optIdx = mode === "home" ? 1 : 0;
      await openDayOption(refreshed, activeWeekData, optIdx, label);
      return;
    }

    const stored = getDayOptions(focusDay);
    const idx = stored.findIndex((o) => o.label === mode.label);
    await openDayOption(focusDay, activeWeekData, idx >= 0 ? idx : 0, mode.label);
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
  }

  async function removeSlot(itemId: string) {
    if (!focus) return;
    setSaving(true);
    await fetch(
      `/api/workouts/${focus.workoutId}/exercises?itemId=${encodeURIComponent(itemId)}`,
      { method: "DELETE" },
    );
    setSaving(false);
    const idx = slots.findIndex((s) => s?.id === itemId);
    if (idx >= 0) {
      setCheckedSlots((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
    await loadSlots(focus.workoutId, prescription);
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
  }

  async function publishDay() {
    if (!focus) return;
    setSaving(true);
    try {
      await patchDay(focus.dayId, { publishedAt: new Date().toISOString() });
      setMessage("Day published.");
      setTimeout(() => setMessage(null), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function addCustomOption(dayId: string) {
    const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
    const day = week?.days.find((d) => d.id === dayId);
    if (!day) return;
    const opts = [...getDayOptions(day)];
    const label = `Setting ${opts.length + 1}`;
    opts.push({ workoutId: "", label });
    await setDayOptions(dayId, opts);
  }

  async function copyWeek(
    fromWeekNumber: number,
    toWeekNumber: number,
    opts?: { manageSaving?: boolean },
  ) {
    const manageSaving = opts?.manageSaving !== false;
    const fromWeek = program.weeks.find((w) => w.weekNumber === fromWeekNumber);
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

        const fromOpts = getDayOptions(fromDay).filter((o) => o.workoutId);
        const toCal =
          toDay.calendarDate ||
          calendarDateForProgramDay(startMonday, toWeekNumber, toDay.dayNumber);

        if (fromOpts.length === 0) {
          await patchDay(toDay.id, { options: [], calendarDate: toCal });
          continue;
        }

        const clonedOpts: DayOption[] = [];
        for (const opt of fromOpts) {
          const dayLabel = DAY_LABELS[toDay.dayNumber - 1] ?? `Day${toDay.dayNumber}`;
          const cloneRes = await fetch(`/api/workouts/${opt.workoutId}/clone`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `${program.name} · W${toWeekNumber} ${dayLabel} ${opt.label}`,
            }),
          });
          if (!cloneRes.ok) {
            if (manageSaving) setMessage("Copy failed — try again.");
            return false;
          }
          const cloned = await cloneRes.json();
          clonedOpts.push({ workoutId: cloned.id, label: opt.label });
          setAllWorkouts((prev) =>
            prev.some((w) => w.id === cloned.id) ? prev : [...prev, { id: cloned.id, name: cloned.name }],
          );
        }

        await patchDay(toDay.id, {
          options: clonedOpts,
          defaultSets: fromDay.defaultSets ?? null,
          defaultReps: fromDay.defaultReps ?? null,
          defaultRestSec: fromDay.defaultRestSec ?? null,
          publishedAt: fromDay.publishedAt ?? null,
          calendarDate: toCal,
          videoUrl: fromDay.videoUrl ?? null,
        });
      }

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
    const ok = await copyWeek(activeWeek - 1, activeWeek);
    if (ok) {
      await sync();
      setMessage(`Week ${activeWeek} copied — each day has its own workout copy.`);
      setTimeout(() => setMessage(null), 3500);
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
      setMessage(`Week ${fromWeekNumber} copied to all remaining weeks.`);
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
      const dayLabel = DAY_LABELS[targetDay.dayNumber - 1] || `D${targetDay.dayNumber}`;
      const clonedOpts: DayOption[] = [];

      for (const opt of sourceOpts) {
        const cloneRes = await fetch(`/api/workouts/${opt.workoutId}/clone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${program.name} · ${formatShortDate(cal)} ${opt.label}`,
          }),
        });
        if (!cloneRes.ok) continue;
        const cloned = await cloneRes.json();
        clonedOpts.push({ workoutId: cloned.id, label: opt.label });
        setAllWorkouts((prev) =>
          prev.some((w) => w.id === cloned.id) ? prev : [...prev, { id: cloned.id, name: cloned.name }],
        );
      }

      if (clonedOpts.length > 0) {
        await patchDay(targetId, {
          options: clonedOpts,
          defaultSets: sourceDay.defaultSets ?? prescription.defaultSets,
          defaultReps: sourceDay.defaultReps ?? prescription.defaultReps,
          defaultRestSec: sourceDay.defaultRestSec ?? prescription.defaultRestSec,
          calendarDate: cal,
        });
        copied++;
      }
    }

    setSaving(false);
    setShowDuplicate(false);
    setDuplicateTargets(new Set());
    setMessage(`Copied to ${copied} day(s). Each has its own workout copy.`);
    setTimeout(() => setMessage(null), 3000);
    await sync();
  }

  const focusDay = focus
    ? program.weeks.flatMap((w) => w.days).find((d) => d.id === focus.dayId)
    : null;

  const duplicateMonth = focusDay?.calendarDate
    ? parseIsoMonth(focusDay.calendarDate)
    : { year: startMonday.getFullYear(), month: startMonday.getMonth() };

  const monthDayCells = daysInMonth(duplicateMonth.year, duplicateMonth.month);

  function renderExerciseSlot(idx: number) {
    const slot = slots[idx];
    const isSelected = selectedSlotIdx === idx;
    const isChecked = checkedSlots.has(idx);

    return (
      <div
        key={idx}
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 transition ${
          isChecked
            ? "border-emerald-400 bg-emerald-500/20"
            : isSelected
              ? "border-accent bg-accent/10"
              : "border-[var(--border)] bg-[var(--surface-2)] hover:border-accent/30"
        }`}
      >
        {slot ? (
          <>
            <input
              type="checkbox"
              className="h-3.5 w-3.5 shrink-0"
              checked={isChecked}
              onChange={(e) => toggleSlotChecked(idx, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => selectSlot(idx, slots, prescription)}
            >
              <span className="block truncate text-xs font-medium">{slot.name}</span>
              <span className="text-[10px] text-[var(--muted)]">
                {slot.sets ?? editorSets} × {slot.reps ?? editorReps}
                {slot.restSec != null ? ` · ${slot.restSec}s` : ""}
              </span>
            </button>
            <div className="w-24 shrink-0" onClick={(e) => e.stopPropagation()}>
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
              className="shrink-0 text-[10px] text-[var(--danger)]"
              onClick={() => void removeSlot(slot.id)}
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span>Mon-anchored calendar · Today/SMS unchanged</span>
        <div className="flex gap-1">
          <Link href="/admin/exercises" className="btn-ghost px-2 py-0.5 text-[10px]">
            Library
          </Link>
          <button type="button" className="btn-ghost px-2 py-0.5 text-[10px]" onClick={() => void sync()}>
            Refresh
          </button>
        </div>
      </div>

      {message && <p className="text-sm text-[var(--success)]">{message}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[var(--muted)]">Jump to week</span>
        {weeks.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              activeWeek === w.weekNumber
                ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                : "bg-[var(--surface-2)] text-[var(--muted)]"
            }`}
            onClick={() => setActiveWeek(w.weekNumber)}
          >
            Week {w.weekNumber}
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
            <div className="flex flex-wrap gap-2">
              {activeWeekData.weekNumber > 1 && (
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  disabled={saving}
                  onClick={() => void copyWeekToThisWeek()}
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
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {[...activeWeekData.days]
              .sort((a, b) => a.dayNumber - b.dayNumber)
              .map((day) => {
                const cal =
                  day.calendarDate ||
                  calendarDateForProgramDay(startMonday, activeWeekData.weekNumber, day.dayNumber);
                const isSelected = focus?.dayId === day.id;
                const isExpanded = expandedDays.has(day.id);
                const published = !!day.publishedAt;
                const dayPreview = previewForDay(day);
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
                        <p className={`text-xs leading-none ${dayGridTextClass(isSelected, published, "title")}`}>
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
            <div className="flex items-center gap-2.5 rounded-md border-2 border-emerald-500/50 bg-emerald-950/50 px-3 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-base font-extrabold text-emerald-950">
                ✓
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold tracking-wide text-emerald-300">Published — complete</p>
                <p className="text-[10px] text-emerald-400/90">
                  This day is finished. You can still view or duplicate it.
                </p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">
                {DAY_LABELS[focus.dayNumber - 1]}{" "}
                <span className="font-normal text-[var(--muted)]">
                  {formatShortDate(
                    focusDay.calendarDate ||
                      calendarDateForProgramDay(startMonday, focus.weekNumber, focus.dayNumber),
                  )}
                </span>
                <span className="ml-1 text-xs text-violet-300">· {focus.label}</span>
                {focusDay.publishedAt && (
                  <span className="ml-1.5 inline-flex items-center rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/40">
                    ✓ Published
                  </span>
                )}
              </h3>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
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
                    href={`/member/programs/${program.slug}`}
                    className="text-[10px] text-[var(--muted)] hover:text-accent hover:underline"
                  >
                    Member view
                  </Link>
                </>
              )}
              <button
                type="button"
                className={
                  focusDay.publishedAt
                    ? "cursor-default rounded-md border-2 border-emerald-500/60 bg-emerald-950/40 px-2 py-1 text-xs font-extrabold text-emerald-300"
                    : "btn-primary px-2 py-1 text-xs"
                }
                disabled={saving || !!focusDay.publishedAt}
                onClick={() => void publishDay()}
              >
                {focusDay.publishedAt ? "✓ Published" : "Publish"}
              </button>
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
            <h3 className="font-semibold">Assign this day&apos;s workout to other days</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {formatMonthYear(toIsoDate(new Date(duplicateMonth.year, duplicateMonth.month, 1)))} —
              each target gets its own copy.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {program.weeks.flatMap((w) =>
                w.days.map((d) => {
                  const cal =
                    d.calendarDate ||
                    calendarDateForProgramDay(startMonday, w.weekNumber, d.dayNumber);
                  const [y, m] = cal.split("-").map(Number);
                  if (y !== duplicateMonth.year || m - 1 !== duplicateMonth.month) return null;
                  const checked = duplicateTargets.has(d.id);
                  return (
                    <label
                      key={d.id}
                      className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-xs ${
                        checked ? "border-accent bg-accent/10" : "border-[var(--border)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setDuplicateTargets((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(d.id);
                            else next.delete(d.id);
                            return next;
                          });
                        }}
                      />
                      <span>
                        {DAY_LABELS[d.dayNumber - 1]} {formatShortDate(cal)}
                      </span>
                    </label>
                  );
                }),
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
              {monthDayCells.map((cell) => {
                const match = program.weeks.flatMap((w) =>
                  w.days.map((d) => ({
                    d,
                    cal:
                      d.calendarDate ||
                      calendarDateForProgramDay(startMonday, w.weekNumber, d.dayNumber),
                  })),
                ).find((x) => x.cal === cell.iso);
                if (!match) return null;
                const checked = duplicateTargets.has(match.d.id);
                return (
                  <label key={cell.iso} className="flex items-center gap-1 text-[10px]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setDuplicateTargets((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(match.d.id);
                          else next.delete(match.d.id);
                          return next;
                        });
                      }}
                    />
                    {cell.day}
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