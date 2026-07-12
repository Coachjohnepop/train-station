"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import TextUploadPanel from "@/components/TextUploadPanel";
import { DAY_LABELS } from "@/lib/program-constants";
import { cloneWorkoutContentName, defaultTrackWorkoutTitle } from "@/lib/workout-content-name";
import { isWorkoutSharedAcrossProgramDays } from "@/lib/program-calendar";

type WorkoutOption = { id: string; name: string };

type DayOption = {
  workoutId: string;
  label: string;
};

type ProgramDay = {
  id: string;
  dayNumber: number;
  workoutId: string | null;
  workout: WorkoutOption | null;
  videoUrl?: string | null;
  notes?: string | null;
  options?: DayOption[];
  smsWorkoutText?: string | null;
  smsOverrideActive?: boolean;
  replacesLiveSession?: boolean;
  smsOverrideLabel?: string | null;
};

type ProgramWeek = {
  id: string;
  weekNumber: number;
  days: ProgramDay[];
};

type Program = {
  id: string;
  slug: string;
  name: string;
  durationWeeks: number;
  weeks: ProgramWeek[];
};

type FocusedOption = {
  dayId: string;
  optIdx: number;
  workoutId: string;
  label: string;
  weekNumber: number;
  dayNumber: number;
};

type FocusedExercise = {
  id: string;
  exerciseId: string;
  name: string;
  sets: number | null;
  reps: string | null;
};

type LibraryEx = { id: string; name: string; tags?: string | null };

export default function ProgramScheduleBuilder({
  program: initial,
  workouts: initialWorkouts,
}: {
  program: Program;
  workouts: WorkoutOption[];
}) {
  const [program, setProgram] = useState(initial);
  const [allWorkouts, setAllWorkouts] = useState<WorkoutOption[]>(initialWorkouts);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Tight builder state: one focused editor strip for the active day option (saves screen real estate)
  const [focused, setFocused] = useState<FocusedOption | null>(null);
  const [focusedExercises, setFocusedExercises] = useState<FocusedExercise[]>([]);
  const [library, setLibrary] = useState<LibraryEx[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [loadingFocused, setLoadingFocused] = useState(false);
  const [workoutPreviews, setWorkoutPreviews] = useState<Record<string, string[]>>({});

  // Load exercise library once (for picker)
  useEffect(() => {
    fetch("/api/exercises")
      .then((r) => r.json())
      .then((data) => setLibrary(data.map((e: any) => ({ id: e.id, name: e.name, tags: e.tags }))))
      .catch(() => {});
  }, []);

  const sync = useCallback(async () => {
    const res = await fetch(`/api/programs/${program.slug}/sync`, {
      method: "POST",
    });
    if (res.ok) {
      setProgram(await res.json());
    }
  }, [program.slug]);

  function getDayOptions(day: ProgramDay): DayOption[] {
    if (day.options && day.options.length > 0) return day.options;
    if (day.workoutId) return [{ workoutId: day.workoutId, label: "Gym" }];
    return [];
  }

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
    if (program.weeks.length < program.durationWeeks) {
      sync();
    }
  }, [program.durationWeeks, program.weeks.length, sync]);

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
  }, [program.weeks, loadWorkoutPreview]);

  // Load exercises for the focused option's workout (compact editor data)
  const loadFocused = useCallback(async (f: FocusedOption) => {
    setLoadingFocused(true);
    try {
      const res = await fetch(`/api/workouts/${f.workoutId}`);
      if (res.ok) {
        const w = await res.json();
        const items: FocusedExercise[] = (w.exercises || []).map((it: any) => ({
          id: it.id,
          exerciseId: it.exercise?.id || it.exerciseId,
          name: it.exercise?.name || "Exercise",
          sets: it.sets ?? null,
          reps: it.reps ?? null,
        }));
        setFocusedExercises(items);
      } else {
        setFocusedExercises([]);
      }
    } catch {
      setFocusedExercises([]);
    }
    setLoadingFocused(false);
  }, []);

  // Ensure there is a workout linked to this specific day option. Creates one on the fly if needed.
  // This lets the coach "pick gym or at home then pick the exercises" directly under Programs.
  async function ensureWorkoutForOption(dayId: string, optIdx: number, desiredLabel: string): Promise<string | null> {
    const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
    if (!week) return null;
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return null;

    const currentOpts = [...getDayOptions(day)];

    let target = currentOpts[optIdx];
    if (target?.workoutId) {
      if (isWorkoutSharedAcrossProgramDays(program, target.workoutId, dayId)) {
        const sourceWorkout = allWorkouts.find((w) => w.id === target.workoutId);
        const cloneRes = await fetch(`/api/workouts/${target.workoutId}/clone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: cloneWorkoutContentName(sourceWorkout?.name || "", desiredLabel),
          }),
        });
        if (cloneRes.ok) {
          const cloned = await cloneRes.json();
          const updatedOpts = [...currentOpts];
          updatedOpts[optIdx] = { ...updatedOpts[optIdx], workoutId: cloned.id };
          await setDayOptions(dayId, updatedOpts);
          setAllWorkouts((prev) =>
            prev.some((w) => w.id === cloned.id) ? prev : [...prev, { id: cloned.id, name: cloned.name }],
          );
          setMessage("This day now has its own workout copy.");
          setTimeout(() => setMessage(null), 2500);
          return cloned.id as string;
        }
      }
      return target.workoutId;
    }

    // Create a new workout with a sensible name for this slot
    const dayLabel = DAY_LABELS[day.dayNumber - 1] ?? `Day${day.dayNumber}`;
    const suggestedName = defaultTrackWorkoutTitle(desiredLabel);
    setMessage("Creating workout slot…");

    const createRes = await fetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: suggestedName }),
    });
    if (!createRes.ok) {
      setMessage("Could not create workout for this option.");
      return null;
    }
    const created = await createRes.json();
    const newWorkoutId = created.id as string;

    // Update the option in place with the new workout
    const updatedOpts = [...currentOpts];
    if (!updatedOpts[optIdx]) {
      updatedOpts[optIdx] = { workoutId: newWorkoutId, label: desiredLabel };
    } else {
      updatedOpts[optIdx] = { ...updatedOpts[optIdx], workoutId: newWorkoutId };
    }

    // Persist via the existing day options PATCH (re-uses current setDayOptions logic)
    await setDayOptions(dayId, updatedOpts);

    // Keep local workouts list fresh for any legacy selects
    setAllWorkouts((prev) => {
      if (prev.some((w) => w.id === newWorkoutId)) return prev;
      return [...prev, { id: newWorkoutId, name: suggestedName }];
    });

    setMessage("New slot ready — add exercises below.");
    setTimeout(() => setMessage(null), 1600);

    return newWorkoutId;
  }

  // Focus a specific day option for the tight inline exercise builder (one at a time to avoid wasting space)
  async function focusOption(dayId: string, optIdx: number, workoutId: string | null, label: string) {
    const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
    if (!week) return;
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return;

    const effectiveWorkoutId = workoutId || (await ensureWorkoutForOption(dayId, optIdx, label));
    if (!effectiveWorkoutId) return;

    const f: FocusedOption = {
      dayId,
      optIdx,
      workoutId: effectiveWorkoutId,
      label,
      weekNumber: week.weekNumber,
      dayNumber: day.dayNumber,
    };
    setFocused(f);
    setPickerSearch("");
    await loadFocused(f);
    void loadWorkoutPreview(effectiveWorkoutId);
  }

  async function openDayBuilder(day: ProgramDay, week: ProgramWeek) {
    const opts = getDayOptions(day);
    if (opts.length === 0) {
      await addOptionToDay(day.id, "Gym");
      return;
    }
    const gymIdx = opts.findIndex((opt) => /gym/i.test(opt.label));
    const idx = gymIdx >= 0 ? gymIdx : 0;
    await focusOption(day.id, idx, opts[idx].workoutId || null, opts[idx].label || "Gym");
  }

  async function assignLibraryWorkout(
    dayId: string,
    optIdx: number,
    workoutId: string,
    label: string,
  ) {
    const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
    if (!week) return;
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return;

    const currentOpts = [...getDayOptions(day)];
    while (currentOpts.length <= optIdx) {
      currentOpts.push({ workoutId: "", label: "Gym" });
    }
    currentOpts[optIdx] = { ...currentOpts[optIdx], workoutId, label: currentOpts[optIdx].label || label };
    await setDayOptions(dayId, currentOpts);
    await focusOption(dayId, optIdx, workoutId, currentOpts[optIdx].label || label);
  }

  // Quick add with adult-simple defaults (easy changes to sets/reps happen right after in the list)
  async function quickAddExercise(exerciseId: string, exerciseName: string) {
    if (!focused) return;
    setSaving(focused.dayId);

    const payload = {
      exerciseId,
      setScheme: "standard",
      repPattern: null,
      reps: "8-10",
      sets: 3,
      weightTier: "medium",
      notes: null,
    };

    const res = await fetch(`/api/workouts/${focused.workoutId}/exercises`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(null);
    if (!res.ok) {
      setMessage("Could not add exercise — try again.");
      setTimeout(() => setMessage(null), 1800);
      return;
    }
    await loadFocused(focused);
    void loadWorkoutPreview(focused.workoutId);
    setMessage("Added. Tweak sets/reps below.");
    setTimeout(() => setMessage(null), 1200);
  }

  async function updateSetsReps(itemId: string, sets: number | null, reps: string | null) {
    if (!focused) return;
    // Optimistic
    setFocusedExercises((prev) => prev.map((it) => (it.id === itemId ? { ...it, sets, reps } : it)));

    const res = await fetch(`/api/workouts/${focused.workoutId}/exercises`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, sets, reps }),
    });
    if (!res.ok) {
      setMessage("Save failed for sets/reps.");
      setTimeout(() => setMessage(null), 1400);
      // reload to correct
      await loadFocused(focused);
    }
  }

  async function exchangeExercise(itemId: string, newExerciseId: string, _newName: string) {
    if (!focused) return;
    setSaving(focused.dayId);
    const current = focusedExercises.find((e) => e.id === itemId);
    const res = await fetch(`/api/workouts/${focused.workoutId}/exercises`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        exerciseId: newExerciseId,
        reps: current?.reps || "8-10",
        sets: current?.sets || 3,
      }),
    });
    setSaving(null);
    if (!res.ok) {
      setMessage("Swap failed — try again.");
      setTimeout(() => setMessage(null), 1400);
      await loadFocused(focused);
      return;
    }
    await loadFocused(focused);
  }

  async function removeFocusedItem(itemId: string) {
    if (!focused) return;
    setSaving(focused.dayId);
    const res = await fetch(`/api/workouts/${focused.workoutId}/exercises?itemId=${encodeURIComponent(itemId)}`, { method: "DELETE" });
    setSaving(null);
    if (!res.ok) {
      setMessage("Remove failed.");
      return;
    }
    await loadFocused(focused);
  }

  // Close the compact editor
  function closeEditor() {
    setFocused(null);
    setFocusedExercises([]);
    setPickerSearch("");
  }

  async function assignWorkout(dayId: string, workoutId: string | null) {
    setSaving(dayId);
    setMessage(null);
    const res = await fetch(`/api/programs/days/${dayId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workoutId }),
    });
    setSaving(null);
    if (!res.ok) {
      setMessage("Could not save — try again.");
      return;
    }
    const updated = (await res.json()) as ProgramDay & {
      workout: WorkoutOption | null;
    };
    setProgram((prev) => ({
      ...prev,
      weeks: prev.weeks.map((week) => ({
        ...week,
        days: week.days.map((d) =>
          d.id === dayId
            ? {
                ...d,
                workoutId: updated.workoutId,
                workout: updated.workout,
              }
            : d,
        ),
      })),
    }));
    setMessage("Saved.");
    setTimeout(() => setMessage(null), 2000);
  }

  async function saveSmsOverride(day: ProgramDay, smsWorkoutText: string, replacesLiveSession: boolean) {
    setSaving(day.id);
    setMessage(null);
    const res = await fetch("/api/admin/schedule-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayId: day.id,
        programSlug: program.slug,
        weekNumber: program.weeks.find((w) => w.days.some((d) => d.id === day.id))?.weekNumber,
        dayNumber: day.dayNumber,
        smsWorkoutText,
        active: !!smsWorkoutText.trim(),
        replacesLiveSession,
        label: "Coach SMS workout",
      }),
    });
    setSaving(null);
    if (!res.ok) {
      setMessage("Could not save SMS override.");
      return;
    }
    const data = await res.json();
    const saved = data.override;
    setProgram((prev) => ({
      ...prev,
      weeks: prev.weeks.map((week) => ({
        ...week,
        days: week.days.map((d) =>
          d.id === day.id
            ? {
                ...d,
                smsWorkoutText: saved.smsWorkoutText,
                smsOverrideActive: saved.active,
                replacesLiveSession: saved.replacesLiveSession,
                smsOverrideLabel: saved.label,
              }
            : d,
        ),
      })),
    }));
    setMessage("SMS override saved.");
    setTimeout(() => setMessage(null), 2000);
  }

  async function clearSmsOverride(dayId: string) {
    setSaving(dayId);
    const res = await fetch(`/api/admin/schedule-overrides?dayId=${encodeURIComponent(dayId)}`, { method: "DELETE" });
    setSaving(null);
    if (!res.ok) return;
    setProgram((prev) => ({
      ...prev,
      weeks: prev.weeks.map((week) => ({
        ...week,
        days: week.days.map((d) =>
          d.id === dayId
            ? {
                ...d,
                smsWorkoutText: null,
                smsOverrideActive: false,
                replacesLiveSession: false,
                smsOverrideLabel: null,
              }
            : d,
        ),
      })),
    }));
    setMessage("SMS override cleared.");
    setTimeout(() => setMessage(null), 2000);
  }

  async function setVideo(dayId: string, videoUrl: string | null) {
    setSaving(dayId);
    setMessage(null);
    const res = await fetch(`/api/programs/days/${dayId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl }),
    });
    setSaving(null);
    if (!res.ok) {
      setMessage("Could not save video — try again.");
      return;
    }
    const updated = await res.json();
    setProgram((prev) => ({
      ...prev,
      weeks: prev.weeks.map((week) => ({
        ...week,
        days: week.days.map((d) =>
          d.id === dayId ? { ...d, videoUrl: updated.videoUrl } : d,
        ),
      })),
    }));
    setMessage("Saved.");
    setTimeout(() => setMessage(null), 2000);
  }

  async function setDayOptions(dayId: string, options: { workoutId: string; label: string }[]) {
    setSaving(dayId);
    setMessage(null);
    const res = await fetch(`/api/programs/days/${dayId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ options }),
    });
    setSaving(null);
    if (!res.ok) {
      setMessage("Could not save options — try again.");
      return;
    }
    const updated = await res.json();
    setProgram((prev) => ({
      ...prev,
      weeks: prev.weeks.map((week) => ({
        ...week,
        days: week.days.map((d) =>
          d.id === dayId
            ? {
                ...d,
                options: updated.options || options,
                workoutId: updated.workoutId || (options[0]?.workoutId ?? null),
                workout: updated.workout || (options[0] ? allWorkouts.find((w) => w.id === options[0].workoutId) || null : null),
              }
            : d,
        ),
      })),
    }));
    setMessage("Saved.");
    setTimeout(() => setMessage(null), 2000);
  }

  async function addOptionToDay(dayId: string, defaultLabel = "Gym") {
    const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
    if (!week) return;
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return;
    const currentOpts = getDayOptions(day);
    await focusOption(dayId, currentOpts.length, null, defaultLabel);
  }

  function updateDayOption(dayId: string, idx: number, field: "workoutId" | "label", value: string) {
    const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
    if (!week) return;
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return;
    const currentOpts = [...getDayOptions(day)];
    if (!currentOpts[idx]) return;
    currentOpts[idx] = { ...currentOpts[idx], [field]: value };
    setDayOptions(dayId, currentOpts);
    if (field === "workoutId" && value) void loadWorkoutPreview(value);
  }

  function removeDayOption(dayId: string, idx: number) {
    const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
    if (!week) return;
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return;
    const currentOpts = [...(day.options || [])];
    currentOpts.splice(idx, 1);
    setDayOptions(dayId, currentOpts);
  }

  /** Clone Gym track → Home on the same day (own copy for small edits). */
  async function copyGymToHome(dayId: string) {
    const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
    const day = week?.days.find((d) => d.id === dayId);
    if (!day) return;

    const opts = [...getDayOptions(day)];
    let gymIdx = opts.findIndex((o) => /^gym$/i.test(o.label.trim()));
    let homeIdx = opts.findIndex((o) => /^home$/i.test(o.label.trim()));

    if (gymIdx < 0) {
      opts.unshift({ workoutId: "", label: "Gym" });
      gymIdx = 0;
      homeIdx = homeIdx < 0 ? -1 : homeIdx + 1;
    }
    if (homeIdx < 0) {
      opts.push({ workoutId: "", label: "Home" });
      homeIdx = opts.length - 1;
    }

    const gymId = opts[gymIdx]?.workoutId;
    if (!gymId) {
      setMessage("Build the Gym workout first, then copy to Home.");
      setTimeout(() => setMessage(null), 2500);
      return;
    }

    const homeId = opts[homeIdx]?.workoutId;
    if (homeId && homeId !== gymId) {
      const ok = window.confirm(
        "Replace Home with a copy of Gym? (Gym stays the same.)",
      );
      if (!ok) return;
    }

    setSaving(dayId);
    setMessage("Copying Gym → Home…");
    try {
      const sourceWorkout = allWorkouts.find((w) => w.id === gymId);
      const cloneRes = await fetch(`/api/workouts/${gymId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cloneWorkoutContentName(sourceWorkout?.name || "Workout", "Home"),
        }),
      });
      if (!cloneRes.ok) {
        setMessage("Copy failed — try again.");
        return;
      }
      const cloned = await cloneRes.json();
      opts[homeIdx] = { workoutId: cloned.id, label: "Home" };
      await setDayOptions(dayId, opts);
      setAllWorkouts((prev) =>
        prev.some((w) => w.id === cloned.id)
          ? prev
          : [...prev, { id: cloned.id, name: cloned.name }],
      );
      void loadWorkoutPreview(cloned.id);
      await focusOption(dayId, homeIdx, cloned.id, "Home");
      setMessage("Gym copied to Home — edit Home only.");
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage("Copy failed — try again.");
    } finally {
      setSaving(null);
    }
  }

  async function copyWeek(fromWeekNumber: number, toWeekNumber: number) {
    const fromWeek = program.weeks.find((w) => w.weekNumber === fromWeekNumber);
    const toWeek = program.weeks.find((w) => w.weekNumber === toWeekNumber);
    if (!fromWeek || !toWeek) return;

    setSaving("copy-week");
    setMessage(`Copying week ${fromWeekNumber} → week ${toWeekNumber}…`);

    for (const toDay of [...toWeek.days].sort((a, b) => a.dayNumber - b.dayNumber)) {
      const fromDay = fromWeek.days.find((d) => d.dayNumber === toDay.dayNumber);
      if (!fromDay) continue;

      const fromOpts = getDayOptions(fromDay);
      if (fromOpts.length === 0) {
        await setDayOptions(toDay.id, []);
        continue;
      }

      const clonedOpts: DayOption[] = [];
      for (const opt of fromOpts) {
        if (!opt.workoutId) {
          clonedOpts.push({ workoutId: "", label: opt.label });
          continue;
        }

        const sourceWorkout = allWorkouts.find((w) => w.id === opt.workoutId);
        const cloneRes = await fetch(`/api/workouts/${opt.workoutId}/clone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: cloneWorkoutContentName(sourceWorkout?.name || "", opt.label),
          }),
        });

        if (!cloneRes.ok) {
          setMessage("Copy failed — try again.");
          setSaving(null);
          return;
        }

        const cloned = await cloneRes.json();
        clonedOpts.push({ workoutId: cloned.id, label: opt.label });
        setAllWorkouts((prev) => {
          if (prev.some((w) => w.id === cloned.id)) return prev;
          return [...prev, { id: cloned.id, name: cloned.name }];
        });
        void loadWorkoutPreview(cloned.id);
      }

      await setDayOptions(toDay.id, clonedOpts);
      if (fromDay.videoUrl) {
        await setVideo(toDay.id, fromDay.videoUrl);
      }
    }

    await sync();
    setSaving(null);
    setMessage(`Week ${toWeekNumber} copied — each day has its own workout copy.`);
    setTimeout(() => setMessage(null), 3500);
  }

  async function copyWeekToRemaining(fromWeekNumber: number) {
    const later = [...program.weeks]
      .filter((w) => w.weekNumber > fromWeekNumber)
      .sort((a, b) => a.weekNumber - b.weekNumber);
    for (const week of later) {
      await copyWeek(fromWeekNumber, week.weekNumber);
    }
  }

  async function clearWeek(weekNumber: number) {
    const week = program.weeks.find((w) => w.weekNumber === weekNumber);
    if (!week) return;

    setMessage(null);
    for (const day of week.days) {
      await setDayOptions(day.id, []);
    }
    setMessage("Week cleared to rest.");
    setTimeout(() => setMessage(null), 2000);
  }

  const weeks = [...program.weeks].sort(
    (a, b) => a.weekNumber - b.weekNumber,
  );

  const filteredLibrary = pickerSearch.trim()
    ? library.filter((e) =>
        e.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        (e.tags || "").toLowerCase().includes(pickerSearch.toLowerCase())
      )
    : library.slice(0, 8);

  return (
    <div className="space-y-4">
      {/* Ultra-tight header — no wasted real estate */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-[var(--muted)]">
          Click a <span className="font-medium text-foreground">day (Mon…)</span> or <span className="font-medium text-foreground">+Gym</span> → add exercises → copy week (independent copies). Live.
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/workouts" className="btn-ghost text-[10px] px-2 py-0.5">Workouts list</Link>
          <button type="button" className="btn-ghost text-[10px] px-2 py-0.5" onClick={sync}>Refresh</button>
        </div>
      </div>

      {message && (
        <div className="text-[10px] text-[var(--success)]">{message}</div>
      )}

      <TextUploadPanel
        mode="program-week"
        programSlug={program.slug}
        weekOptions={weeks.map((w) => w.weekNumber)}
        onBuilt={async () => {
          await sync();
          setMessage("Week schedule updated from text upload.");
          setTimeout(() => setMessage(null), 3000);
        }}
      />

      {weeks.map((week) => (
        <div key={week.id} className="border border-[var(--border)] rounded-md p-2">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs font-semibold text-accent-deep">Week {week.weekNumber}</div>
            <div className="flex gap-1.5">
              {week.weekNumber > 1 && (
                <button
                  type="button"
                  className="btn-ghost text-[10px] px-1.5 py-px"
                  onClick={() => copyWeek(week.weekNumber - 1, week.weekNumber)}
                  disabled={!!saving}
                >
                  Copy to this week
                </button>
              )}
              {week.weekNumber === 1 && program.durationWeeks > 1 && (
                <button
                  type="button"
                  className="btn-ghost text-[10px] px-1.5 py-px"
                  onClick={() => copyWeekToRemaining(1)}
                  disabled={!!saving}
                >
                  Copy to all remaining
                </button>
              )}
              <button
                type="button"
                className="btn-ghost text-[10px] px-1.5 py-px text-[var(--danger)]"
                onClick={() => clearWeek(week.weekNumber)}
                disabled={!!saving}
              >
                Clear week
              </button>
            </div>
          </div>

          {/* Dense day rows — minimal chrome */}
          <div className="space-y-px">
            {[...week.days].sort((a, b) => a.dayNumber - b.dayNumber).map((day) => {
              const dayName = DAY_LABELS[day.dayNumber - 1] ?? `D${day.dayNumber}`;
              const opts = getDayOptions(day);

              return (
                <div key={day.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--border)]/60 pt-1 first:border-0 first:pt-0 text-[11px]">
                  <button
                    type="button"
                    className="w-9 shrink-0 text-left font-semibold text-accent hover:underline"
                    title={`Open ${dayName} workout builder`}
                    onClick={() => void openDayBuilder(day, week)}
                    disabled={!!saving}
                  >
                    {dayName}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 text-[9px] font-semibold text-violet-300 hover:underline disabled:opacity-40"
                    title="Clone Gym into Home on this day for small edits"
                    disabled={!!saving}
                    onClick={() => void copyGymToHome(day.id)}
                  >
                    Gym→Home
                  </button>

                  {/* Options (Gym/Home etc) — very compact */}
                  <div className="flex-1 min-w-[260px] flex flex-wrap items-center gap-1.5">
                    {opts.length === 0 && (
                      <span className="text-[var(--muted)]/70">Rest / unassigned</span>
                    )}

                    {opts.map((opt, idx) => {
                      const isFocused = focused && focused.dayId === day.id && focused.optIdx === idx;
                      return (
                        <div key={idx} className={`inline-flex flex-wrap items-center gap-1 rounded border px-1 py-px ${isFocused ? "border-accent" : "border-[var(--border)]"}`}>
                          <input
                            className="bg-transparent w-14 text-[10px] focus:outline-none"
                            value={opt.label}
                            onChange={(e) => updateDayOption(day.id, idx, "label", e.target.value)}
                            placeholder="Label"
                            disabled={saving === day.id}
                          />
                          <select
                            className="max-w-[150px] truncate border-0 bg-transparent text-[10px] focus:outline-none"
                            value={opt.workoutId || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "__build__") {
                                void focusOption(day.id, idx, opt.workoutId || null, opt.label || "Gym");
                                return;
                              }
                              if (value) {
                                void assignLibraryWorkout(day.id, idx, value, opt.label || "Gym");
                              }
                            }}
                            disabled={saving === day.id}
                            title="Assign an existing workout"
                          >
                            <option value="">{opt.workoutId ? "Change workout…" : "Pick workout…"}</option>
                            {allWorkouts.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name.length > 36 ? `${w.name.slice(0, 34)}…` : w.name}
                              </option>
                            ))}
                            <option value="__build__">+ Build exercises here</option>
                          </select>
                          {opt.workoutId && workoutPreviews[opt.workoutId]?.length > 0 && (
                            <span className="max-w-[180px] truncate text-[9px] text-[var(--muted)]" title={workoutPreviews[opt.workoutId].join(" · ")}>
                              {workoutPreviews[opt.workoutId].join(" · ")}
                            </span>
                          )}
                          {opt.workoutId && (
                            <Link
                              href={`/admin/workouts/${opt.workoutId}`}
                              className="text-[10px] text-accent hover:underline"
                            >
                              Edit →
                            </Link>
                          )}
                          <button
                            type="button"
                            className="text-[10px] px-0.5 text-accent"
                            onClick={() => focusOption(day.id, idx, opt.workoutId || null, opt.label || "Gym")}
                            title="Pick / edit exercises for this option"
                          >
                            +ex
                          </button>

                          {opts.length > 1 && (
                            <button
                              type="button"
                              className="text-[var(--danger)]/70 px-0.5 leading-none"
                              onClick={() => removeDayOption(day.id, idx)}
                              disabled={saving === day.id}
                              title="Remove this option"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Add option buttons — tiny */}
                    <button type="button" className="btn-ghost text-[10px] px-1 py-px" onClick={() => void addOptionToDay(day.id, "Gym")} disabled={saving === day.id}>+Gym</button>
                    <button type="button" className="btn-ghost text-[10px] px-1 py-px" onClick={() => void addOptionToDay(day.id, "Home")} disabled={saving === day.id}>+Home</button>
                  </div>

                  {/* Optional video / notes kept tiny and to the side */}
                  <input
                    className="input text-[10px] w-40 py-px"
                    placeholder="YT / notes"
                    defaultValue={day.videoUrl || day.notes || ""}
                    onBlur={(e) => setVideo(day.id, e.target.value || null)}
                    disabled={saving === day.id}
                  />

                  <details className="w-full text-[10px]">
                    <summary className="cursor-pointer text-amber-300/90">
                      {day.smsOverrideActive ? "SMS override active" : "SMS workout override"}
                    </summary>
                    <div className="mt-1 space-y-1 rounded border border-amber-500/20 bg-amber-500/5 p-1.5">
                      <textarea
                        className="input w-full h-16 text-[10px] font-mono"
                        placeholder="Paste SMS workout text to override this day..."
                        defaultValue={day.smsWorkoutText || ""}
                        onBlur={(e) => {
                          const text = e.target.value.trim();
                          if (text) saveSmsOverride(day, text, true);
                          else if (day.smsOverrideActive) clearSmsOverride(day.id);
                        }}
                        disabled={saving === day.id}
                      />
                      {day.smsOverrideActive && (
                        <button
                          type="button"
                          className="text-[10px] text-[var(--danger)] underline"
                          onClick={() => clearSmsOverride(day.id)}
                          disabled={saving === day.id}
                        >
                          Clear override
                        </button>
                      )}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* THE TIGHT COMPACT EXERCISE EDITOR STRIP — single focused surface, no screen waste */}
      <div className="sticky bottom-2 z-10 border border-[var(--border)] bg-[var(--surface)] rounded-md p-2 text-xs shadow-sm">
        {!focused ? (
          <div className="text-[var(--muted)] text-[10px]">
            Click <span className="font-medium">+ex</span> on any Gym/Home option above, or an option name, to pick exercises and set reps here. One editor at a time keeps it clean.
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="font-medium">
                Week {focused.weekNumber} · {DAY_LABELS[focused.dayNumber - 1] ?? `D${focused.dayNumber}`} — <span className="text-accent">{focused.label}</span>
                {loadingFocused && <span className="ml-2 text-[var(--muted)]">loading…</span>}
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/admin/workouts/${focused.workoutId}`} className="text-[10px] text-accent hover:underline">full workout page</Link>
                <button type="button" className="text-[10px] text-[var(--muted)]" onClick={closeEditor}>close editor</button>
              </div>
            </div>

            {/* Search + quick results — extremely tight */}
            <div className="flex items-center gap-2 mb-1.5">
              <input
                className="input flex-1 text-xs py-1"
                placeholder="Type to search exercises (e.g. bench, row, squat, core)…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
              />
              <button type="button" className="btn-ghost text-[10px] px-2 py-1" onClick={() => setPickerSearch("")}>clear</button>
            </div>

            {/* Quick add pills — dense, no big lists */}
            <div className="flex flex-wrap gap-1 mb-1.5">
              {filteredLibrary.slice(0, 9).map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--surface-2)] active:bg-accent/10"
                  onClick={() => quickAddExercise(ex.id, ex.name)}
                  disabled={!!saving}
                >
                  + {ex.name.length > 22 ? ex.name.slice(0, 20) + "…" : ex.name}
                </button>
              ))}
              {filteredLibrary.length === 0 && pickerSearch && (
                <span className="text-[var(--muted)] text-[10px]">No matches. Add new exercises in the Exercise Library.</span>
              )}
            </div>

            {/* Current exercises — ultra compact rows for sets/reps/exchange/delete */}
            <div className="border-t border-[var(--border)] pt-1">
              {focusedExercises.length === 0 && !loadingFocused && (
                <div className="text-[var(--muted)] text-[10px] py-0.5">No exercises yet. Use the + pills above to add. Defaults are 3×8-10 — change instantly below.</div>
              )}
              <div className="space-y-px">
                {focusedExercises.map((item) => (
                  <div key={item.id} className="flex items-center gap-1.5 py-px text-[11px]">
                    <div className="min-w-0 flex-1 truncate font-medium">{item.name}</div>

                    {/* Direct sets / reps — the "easy changes" the client asked for */}
                    <span className="text-[var(--muted)]">sets</span>
                    <input
                      type="number"
                      className="w-10 border border-[var(--border)] bg-transparent text-center text-xs py-px"
                      value={item.sets ?? ""}
                      onChange={(e) => {
                        const v = e.target.value ? parseInt(e.target.value, 10) : null;
                        updateSetsReps(item.id, v, item.reps);
                      }}
                      onBlur={() => {/* already saved on change */}}
                    />
                    <span className="text-[var(--muted)]">reps</span>
                    <input
                      className="w-14 border border-[var(--border)] bg-transparent text-xs py-px"
                      value={item.reps ?? ""}
                      onChange={(e) => updateSetsReps(item.id, item.sets, e.target.value || null)}
                      placeholder="8-10"
                    />

                    {/* Exchange (swap exercise) */}
                    <select
                      className="text-[10px] border border-[var(--border)] bg-transparent py-px"
                      defaultValue=""
                      onChange={async (e) => {
                        if (!e.target.value) return;
                        const newEx = library.find((l) => l.id === e.target.value);
                        if (newEx) await exchangeExercise(item.id, newEx.id, newEx.name);
                        e.target.value = "";
                      }}
                      disabled={!!saving}
                    >
                      <option value="">swap…</option>
                      {library.filter((l) => l.id !== item.exerciseId).slice(0, 30).map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="text-[var(--danger)] px-1 leading-none"
                      onClick={() => removeFocusedItem(item.id)}
                      disabled={!!saving}
                      title="Delete exercise"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-1 text-[9px] text-[var(--muted)]">Changes save instantly. Use swap to exchange an exercise while keeping the sets/reps you just set.</div>
            </div>
          </div>
        )}
      </div>

      {weeks.length === 0 && <p className="text-[var(--muted)] text-xs">Loading…</p>}
    </div>
  );
}