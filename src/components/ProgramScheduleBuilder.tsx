"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DAY_LABELS } from "@/lib/program-constants";

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

export default function ProgramScheduleBuilder({
  program: initial,
  workouts,
}: {
  program: Program;
  workouts: WorkoutOption[];
}) {
  const [program, setProgram] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sync = useCallback(async () => {
    const res = await fetch(`/api/programs/${program.slug}/sync`, {
      method: "POST",
    });
    if (res.ok) {
      setProgram(await res.json());
    }
  }, [program.slug]);

  useEffect(() => {
    if (program.weeks.length < program.durationWeeks) {
      sync();
    }
  }, [program.durationWeeks, program.weeks.length, sync]);

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
                workout: updated.workout || (options[0] ? workouts.find((w) => w.id === options[0].workoutId) || null : null),
              }
            : d,
        ),
      })),
    }));
    setMessage("Saved.");
    setTimeout(() => setMessage(null), 2000);
  }

  function addOptionToDay(dayId: string, defaultLabel = "Home") {
    const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
    if (!week) return;
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return;
    const currentOpts = day.options || (day.workoutId ? [{ workoutId: day.workoutId, label: "Gym" }] : []);
    const newOpts = [...currentOpts, { workoutId: "", label: defaultLabel }];
    setDayOptions(dayId, newOpts);
  }

  function updateDayOption(dayId: string, idx: number, field: "workoutId" | "label", value: string) {
    const week = program.weeks.find((w) => w.days.some((d) => d.id === dayId));
    if (!week) return;
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return;
    const currentOpts = [...(day.options || (day.workoutId ? [{ workoutId: day.workoutId, label: "Gym" }] : []))];
    if (!currentOpts[idx]) return;
    currentOpts[idx] = { ...currentOpts[idx], [field]: value };
    setDayOptions(dayId, currentOpts);
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

  async function copyWeek(fromWeekNumber: number, toWeekNumber: number) {
    const fromWeek = program.weeks.find((w) => w.weekNumber === fromWeekNumber);
    const toWeek = program.weeks.find((w) => w.weekNumber === toWeekNumber);
    if (!fromWeek || !toWeek) return;

    setMessage(null);
    for (const day of toWeek.days) {
      const fromDay = fromWeek.days.find((d) => d.dayNumber === day.dayNumber);
      if (fromDay) {
        await assignWorkout(day.id, fromDay.workoutId);
      }
    }
    setMessage("Week copied.");
    setTimeout(() => setMessage(null), 2000);
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

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">
          Assign workouts as <strong>options per day</strong> (e.g. “Gym” + “Home”) so clients can mix environments. Use labels like “Gym”, “Home - Bodyweight”, “Home - Dumbbells”. Equipment on exercises will later filter what’s possible for a client’s home inventory.{" "}
          {program.durationWeeks} weeks · 7 days per week.
        </p>
        <div className="flex gap-2">
          <Link href="/admin/workouts" className="btn-ghost text-sm">
            + New workout
          </Link>
          <button type="button" className="btn-ghost text-sm" onClick={sync}>
            Refresh schedule
          </button>
        </div>
      </div>

      <div className="text-xs text-[var(--muted)]">
        Tip: Use “Copy from prev week” or “Clear to rest” for quick bulk changes per week.
      </div>

      {message && (
        <p className="text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      )}

      {workouts.length === 0 && (
        <p className="text-sm text-[var(--danger)]">
          Create workouts first under{" "}
          <Link href="/admin/workouts" className="text-accent hover:underline">
            Workouts
          </Link>
          , then assign them here.
        </p>
      )}

      {weeks.map((week) => (
        <div key={week.id} className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-accent-deep">
              Week {week.weekNumber}
            </h3>
            <div className="flex gap-2">
              {week.weekNumber > 1 && (
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => copyWeek(week.weekNumber - 1, week.weekNumber)}
                  disabled={!!saving}
                >
                  Copy from prev week
                </button>
              )}
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => clearWeek(week.weekNumber)}
                disabled={!!saving}
              >
                Clear to rest
              </button>
            </div>
          </div>
          <ul className="mt-4 space-y-3">
            {[...week.days]
              .sort((a, b) => a.dayNumber - b.dayNumber)
              .map((day) => {
                const label = DAY_LABELS[day.dayNumber - 1] ?? `Day ${day.dayNumber}`;
                return (
                  <li
                    key={day.id}
                    className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"
                  >
                    <span className="w-12 shrink-0 text-sm font-medium text-[var(--muted)]">
                      {label}
                    </span>

                    {/* Hybrid options support: multiple labeled workouts per day (Gym / Home etc) */}
                    <div className="flex-1 min-w-[280px] space-y-2">
                      {(day.options && day.options.length > 0 ? day.options : (day.workoutId ? [{ workoutId: day.workoutId, label: "Standard" }] : [])).map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            className="input text-xs w-28"
                            value={opt.label}
                            placeholder="Label"
                            onChange={(e) => updateDayOption(day.id, idx, "label", e.target.value)}
                            disabled={saving === day.id}
                          />
                          <select
                            className="input flex-1 text-sm"
                            value={opt.workoutId}
                            disabled={saving === day.id}
                            onChange={(e) => updateDayOption(day.id, idx, "workoutId", e.target.value)}
                          >
                            <option value="">— choose workout —</option>
                            {workouts.map((w) => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </select>
                          {opt.workoutId && (
                            <Link
                              href={`/admin/workouts/${opt.workoutId}`}
                              className="text-xs text-accent hover:underline whitespace-nowrap"
                              title="Edit the exercises, sets, and notes for this workout"
                            >
                              edit →
                            </Link>
                          )}
                          <button
                            type="button"
                            className="text-xs text-[var(--danger)] px-1"
                            onClick={() => removeDayOption(day.id, idx)}
                            disabled={saving === day.id || (day.options?.length || 0) <= 1}
                            title="Remove option"
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          className="btn-ghost text-xs px-2 py-0.5"
                          onClick={() => addOptionToDay(day.id, "Gym")}
                          disabled={saving === day.id}
                        >
                          + Gym option
                        </button>
                        <button
                          type="button"
                          className="btn-ghost text-xs px-2 py-0.5"
                          onClick={() => addOptionToDay(day.id, "Home")}
                          disabled={saving === day.id}
                        >
                          + Home option
                        </button>
                        {(!day.options || day.options.length === 0) && (
                          <button
                            type="button"
                            className="btn-ghost text-xs px-2 py-0.5"
                            onClick={() => assignWorkout(day.id, day.workoutId ?? null)}
                            disabled={saving === day.id}
                          >
                            Use single (legacy)
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      className="input text-xs w-48"
                      placeholder="YouTube URL (for journeys)"
                      defaultValue={day.videoUrl || ""}
                      onBlur={(e) => setVideo(day.id, e.target.value || null)}
                      disabled={saving === day.id}
                    />
                    {saving === day.id && (
                      <span className="text-xs text-[var(--muted)]">
                        Saving…
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}

      {weeks.length === 0 && (
        <p className="text-[var(--muted)]">Loading schedule…</p>
      )}
    </div>
  );
}