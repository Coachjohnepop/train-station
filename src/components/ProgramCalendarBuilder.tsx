"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import SearchableExerciseSelect, {
  type LibraryExercise,
} from "@/components/SearchableExerciseSelect";
import { DAY_LABELS } from "@/lib/program-constants";
import {
  calendarDateForProgramDay,
  DAY_SLOT_COUNT,
  daysInMonth,
  DEFAULT_DAY_OPTIONS,
  formatMonthYear,
  formatShortDate,
  normalizeDayOptions,
  resolveProgramStartMonday,
  slotIndicesForTimeColumn,
  timeBlockLabel,
  toIsoDate,
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
  const [activeWeek, setActiveWeek] = useState(1);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [slots, setSlots] = useState<(SlotItem | null)[]>(Array(DAY_SLOT_COUNT).fill(null));
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
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

  async function setDayOptions(dayId: string, options: DayOption[]) {
    setSaving(true);
    try {
      await patchDay(dayId, { options: normalizeDayOptions(options) as DayOption[] });
      setMessage("Saved.");
      setTimeout(() => setMessage(null), 1500);
    } catch {
      setMessage("Could not save — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function ensureWorkoutForOption(
    dayId: string,
    optIdx: number,
    label: string,
  ): Promise<string | null> {
    const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
    const day = week?.days.find((d) => d.id === dayId);
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

    await setDayOptions(dayId, opts);
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
        setSlots(Array(DAY_SLOT_COUNT).fill(null));
        setSelectedSlotIdx(null);
        return;
      }
      const w = await res.json();
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
      const grid: (SlotItem | null)[] = Array(DAY_SLOT_COUNT).fill(null);
      items.forEach((item, idx) => {
        if (idx < DAY_SLOT_COUNT) grid[idx] = { ...item, sortOrder: idx };
      });
      setSlots(grid);
      const defaults = rx ?? DEFAULT_DAY_PRESCRIPTION;
      const firstFilled = grid.findIndex((s) => s !== null);
      const firstEmpty = grid.findIndex((s) => s === null);
      const pick = firstFilled >= 0 ? firstFilled : firstEmpty >= 0 ? firstEmpty : 0;
      selectSlot(pick, grid, defaults);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  async function openDayOption(day: ProgramDay, week: ProgramWeek, optIdx: number, label: string) {
    if (dayOptionsNeedCleanup(day)) {
      const cleaned = normalizeDayOptions(day.options || []) as DayOption[];
      await patchDay(day.id, { options: cleaned });
      day = { ...day, options: cleaned };
    }

    let opts = getDayOptions(day);
    if (opts.length === 0) {
      await setDayOptions(day.id, [
        { workoutId: "", label: "Gym" },
        { workoutId: "", label: "Home" },
      ]);
      const refreshed = program.weeks
        .find((w) => w.id === week.id)
        ?.days.find((d) => d.id === day.id);
      opts = refreshed ? getDayOptions(refreshed) : [
        { workoutId: "", label: "Gym" },
        { workoutId: "", label: "Home" },
      ];
    }

    const workoutId = await ensureWorkoutForOption(day.id, optIdx, opts[optIdx]?.label || label);
    if (!workoutId) return;

    const rx = readDayPrescription(day);
    setPrescription(rx);
    setCheckedSlots(new Set());
    setFocus({
      dayId: day.id,
      optIdx,
      workoutId,
      label: opts[optIdx]?.label || label,
      weekNumber: week.weekNumber,
      dayNumber: day.dayNumber,
    });
    setExpandedDays((prev) => new Set(prev).add(day.id));

    await seedWarmups(workoutId, rx);
    await loadSlots(workoutId, rx);
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
    setExpandedDays((prev) => new Set(prev).add(day.id));
    const gymIdx = getDayOptions(day).findIndex((o) => /gym/i.test(o.label));
    await openDayOption(day, week, gymIdx >= 0 ? gymIdx : 0, "Gym");
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
          isSelected
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
                const opts = getDayOptions(day);
                const published = !!day.publishedAt;

                return (
                  <div
                    key={day.id}
                    className={`rounded-lg border p-2 transition ${
                      isSelected
                        ? "border-accent bg-accent/10"
                        : "border-[var(--border)] hover:border-accent/40"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left"
                      onClick={() => void selectDay(day, activeWeekData)}
                    >
                      <div>
                        <p className="text-xs font-bold text-accent">
                          {DAY_LABELS[day.dayNumber - 1]}
                        </p>
                        <p className="text-[10px] text-[var(--muted)]">{formatShortDate(cal)}</p>
                      </div>
                      <span className="text-[10px] text-[var(--muted)]">{isExpanded ? "▼" : "▶"}</span>
                    </button>
                    <p className="mt-1 text-[10px] text-[var(--muted)]">
                      {opts.length === 0
                        ? "Empty"
                        : `${opts.length} setting${opts.length === 1 ? "" : "s"}`}
                      {published && <span className="ml-1 text-emerald-400">· Published</span>}
                    </p>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {focus && focusDay && (
        <div className="space-y-2 rounded-lg border border-accent/25 bg-[var(--surface)] p-3">
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
              </h3>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                className="btn-primary px-2 py-1 text-xs"
                disabled={saving}
                onClick={() => void publishDay()}
              >
                Publish
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

          <div className="flex flex-wrap gap-1">
            {getDayOptions(focusDay).map((opt, idx) => (
              <button
                key={idx}
                type="button"
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  focus.optIdx === idx
                    ? "bg-violet-600/30 text-violet-100 ring-1 ring-violet-400/50"
                    : "bg-[var(--surface-2)] text-[var(--muted)]"
                }`}
                onClick={() => void openDayOption(focusDay, activeWeekData!, idx, opt.label)}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              className="rounded-full px-2 py-0.5 text-[10px] text-accent hover:bg-accent/10"
              onClick={() => void addCustomOption(focus.dayId)}
            >
              + setting
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2 rounded-md bg-[var(--surface-2)] px-2 py-1.5">
            <p className="mr-1 max-w-[140px] truncate text-[10px] text-[var(--muted)]">
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
                  {slotIndicesForTimeColumn(col).map((idx) => renderExerciseSlot(idx))}
                </div>
              ))}
            </div>
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