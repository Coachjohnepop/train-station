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
  resolveProgramStartMonday,
  toIsoDate,
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
  if (day.options && day.options.length > 0) return day.options;
  if (day.workoutId) return [{ workoutId: day.workoutId, label: "Gym" }];
  return [];
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
      await patchDay(dayId, { options });
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

  const loadSlots = useCallback(async (workoutId: string) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/workouts/${workoutId}`, { cache: "no-store" });
      if (!res.ok) {
        setSlots(Array(DAY_SLOT_COUNT).fill(null));
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
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  async function openDayOption(day: ProgramDay, week: ProgramWeek, optIdx: number, label: string) {
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
    await loadSlots(workoutId);
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
        reps: prescription.defaultReps,
        sets: prescription.defaultSets,
        weightTier: "medium",
        restSec: prescription.defaultRestSec,
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
    await loadSlots(focus.workoutId);
  }

  async function removeSlot(itemId: string) {
    if (!focus) return;
    setSaving(true);
    await fetch(
      `/api/workouts/${focus.workoutId}/exercises?itemId=${encodeURIComponent(itemId)}`,
      { method: "DELETE" },
    );
    setSaving(false);
    await loadSlots(focus.workoutId);
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
    await loadSlots(focus.workoutId);
  }

  async function applyPrescriptionToDay() {
    if (!focus) return;
    setSaving(true);
    try {
      await patchDay(focus.dayId, {
        defaultSets: prescription.defaultSets,
        defaultReps: prescription.defaultReps,
        defaultRestSec: prescription.defaultRestSec,
      });
      for (const slot of slots) {
        if (!slot) continue;
        await fetch(`/api/workouts/${focus.workoutId}/exercises`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: slot.id,
            sets: prescription.defaultSets,
            reps: prescription.defaultReps,
            restSec: prescription.defaultRestSec,
          }),
        });
      }
      await loadSlots(focus.workoutId);
      setMessage("Day prescription applied to all exercises.");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("Save failed.");
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-[var(--muted)]">
          Week view anchored to real dates — always starts Monday. Today sessions unchanged.
        </p>
        <div className="flex gap-2">
          <Link href="/admin/exercises" className="btn-ghost text-xs">
            Exercise library
          </Link>
          <button type="button" className="btn-ghost text-xs" onClick={() => void sync()}>
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
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">
              Week {activeWeekData.weekNumber}
              <span className="ml-2 text-sm font-normal text-[var(--muted)]">
                {formatMonthYear(
                  calendarDateForProgramDay(startMonday, activeWeekData.weekNumber, 1),
                )}
              </span>
            </h2>
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
        <div className="space-y-4 rounded-xl border border-accent/25 bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">
                {DAY_LABELS[focus.dayNumber - 1]}{" "}
                {formatShortDate(
                  focusDay.calendarDate ||
                    calendarDateForProgramDay(startMonday, focus.weekNumber, focus.dayNumber),
                )}
              </h3>
              <p className="text-sm text-[var(--muted)]">Workout editor — sets/reps/rest apply at day level</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={saving}
                onClick={() => void publishDay()}
              >
                Finish &amp; publish
              </button>
              <button
                type="button"
                className="btn-ghost text-sm"
                disabled={saving}
                onClick={() => setShowDuplicate(true)}
              >
                Duplicate to other days…
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {getDayOptions(focusDay).map((opt, idx) => (
              <button
                key={idx}
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-medium ${
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
              className="rounded-full px-3 py-1 text-xs text-accent hover:bg-accent/10"
              onClick={() => void addCustomOption(focus.dayId)}
            >
              + Add setting
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-lg bg-[var(--surface-2)] p-3">
            <label className="text-xs">
              Sets
              <input
                type="number"
                className="input mt-1 w-16"
                value={prescription.defaultSets}
                onChange={(e) =>
                  setPrescription((p) => ({
                    ...p,
                    defaultSets: parseInt(e.target.value, 10) || 1,
                  }))
                }
              />
            </label>
            <label className="text-xs">
              Reps
              <input
                className="input mt-1 w-20"
                value={prescription.defaultReps}
                onChange={(e) => setPrescription((p) => ({ ...p, defaultReps: e.target.value }))}
              />
            </label>
            <label className="text-xs">
              Rest (sec)
              <input
                type="number"
                className="input mt-1 w-20"
                value={prescription.defaultRestSec}
                onChange={(e) =>
                  setPrescription((p) => ({
                    ...p,
                    defaultRestSec: parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
            </label>
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={saving}
              onClick={() => void applyPrescriptionToDay()}
            >
              Apply to all exercises
            </button>
          </div>

          {loadingSlots ? (
            <p className="text-sm text-[var(--muted)]">Loading exercises…</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slots.map((slot, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3"
                >
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Slot {idx + 1}
                  </p>
                  {slot ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{slot.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {slot.sets ?? prescription.defaultSets} × {slot.reps ?? prescription.defaultReps}
                        {slot.restSec != null ? ` · ${slot.restSec}s rest` : ""}
                      </p>
                      <SearchableExerciseSelect
                        library={library}
                        value=""
                        placeholder="Substitute…"
                        disabled={saving}
                        onChange={(id) => void swapSlot(slot.id, id)}
                      />
                      <button
                        type="button"
                        className="text-xs text-[var(--danger)]"
                        onClick={() => void removeSlot(slot.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <SearchableExerciseSelect
                      library={library}
                      value=""
                      placeholder="Search library…"
                      disabled={saving}
                      onChange={(id) => void assignSlot(idx, id)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-[var(--muted)]">
            New days auto-add Upper body warm up and Shoulder mobility warm. Add up to 9 exercises per
            setting; use Duplicate to fill the rest of the month.
          </p>
        </div>
      )}

      {!focus && (
        <p className="text-sm text-[var(--muted)]">
          Click a day square above to open the workout editor. Gym and Home settings are created automatically.
        </p>
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