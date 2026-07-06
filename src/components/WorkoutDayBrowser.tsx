"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import TextUploadPanel from "@/components/TextUploadPanel";
import { formatApiErrorDetail } from "@/lib/api-errors";
import { DAY_LABELS, PROGRAM_CYCLE_DAYS } from "@/lib/program-constants";
import { cycleDayKey } from "@/lib/program-cycle-day";
import { formatTrainingLocationLabel } from "@/lib/program-calendar";
import { workoutContentTitle } from "@/lib/workout-content-name";

type WorkoutRef = {
  id: string;
  name: string;
  _count?: { exercises: number };
};

type CycleSlot = {
  id: string;
  workoutId: string;
  trainingLocation: string;
  workout: WorkoutRef;
};

type CycleDay = {
  id: string;
  dayNumber: number;
  isDayOff: boolean;
  notes?: string | null;
  slots: CycleSlot[];
};

type WorkoutCycle = {
  id: string;
  name: string;
  description?: string | null;
  programId?: string | null;
  cycleMonth?: number | null;
  clonedFromId?: string | null;
  published: boolean;
  program?: { id: string; slug: string; name: string } | null;
  days: CycleDay[];
};

type ProgramSummary = { slug: string; name: string };

function cycleLabel(cycle: WorkoutCycle): string {
  if (cycle.programId && cycle.cycleMonth) {
    return `${cycle.name} · M${cycle.cycleMonth}`;
  }
  return `${cycle.name} · Library`;
}

function mDayKey(cycleMonth: number | null | undefined, dayNumber: number): string {
  return cycleDayKey(cycleMonth ?? 1, dayNumber);
}

export default function WorkoutDayBrowser() {
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [programSlug, setProgramSlug] = useState("adult");
  const [cycles, setCycles] = useState<WorkoutCycle[]>([]);
  const [libraryCycles, setLibraryCycles] = useState<WorkoutCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCycleName, setNewCycleName] = useState("");
  const [newWorkoutTitle, setNewWorkoutTitle] = useState("");

  const selectedCycle = useMemo(
    () => cycles.find((c) => c.id === selectedCycleId) ?? libraryCycles.find((c) => c.id === selectedCycleId) ?? null,
    [cycles, libraryCycles, selectedCycleId],
  );

  const selectedCycleDay = useMemo(() => {
    if (!selectedCycle) return null;
    return selectedCycle.days.find((d) => d.dayNumber === selectedDay) ?? null;
  }, [selectedCycle, selectedDay]);

  const loadCycles = useCallback(async (slug: string) => {
    const [progRes, libRes] = await Promise.all([
      fetch(`/api/workout-cycles?program=${encodeURIComponent(slug)}`),
      fetch("/api/workout-cycles?library=1"),
    ]);
    if (!progRes.ok) {
      const data = await progRes.json().catch(() => ({}));
      throw new Error(formatApiErrorDetail(data.detail) || "Could not load cycles");
    }
    const progCycles = (await progRes.json()) as WorkoutCycle[];
    const lib = libRes.ok ? ((await libRes.json()) as WorkoutCycle[]) : [];
    setCycles(progCycles);
    setLibraryCycles(lib);
    return { progCycles, lib };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const progListRes = await fetch("/api/programs");
      if (progListRes.ok) {
        const list = (await progListRes.json()) as ProgramSummary[];
        setPrograms(list);
      }
      const { progCycles, lib } = await loadCycles(programSlug);
      const all = [...progCycles, ...lib];
      if (!selectedCycleId || !all.some((c) => c.id === selectedCycleId)) {
        const preferred =
          progCycles.find((c) => c.cycleMonth === 1) ||
          progCycles[0] ||
          lib[0] ||
          null;
        setSelectedCycleId(preferred?.id ?? null);
      } else if (selectedCycleId) {
        const detail = await fetch(`/api/workout-cycles/${selectedCycleId}`);
        if (detail.ok) {
          const full = (await detail.json()) as WorkoutCycle;
          setCycles((prev) => prev.map((c) => (c.id === full.id ? full : c)));
          setLibraryCycles((prev) => prev.map((c) => (c.id === full.id ? full : c)));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [loadCycles, programSlug, selectedCycleId]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when program changes
  }, [programSlug]);

  async function createWorkout(name: string) {
    const res = await fetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    if (!res.ok || !data?.id) {
      throw new Error(formatApiErrorDetail(data.detail) || "Could not create workout");
    }
    return data as WorkoutRef;
  }

  async function assignToSlot(location: "gym" | "home", title?: string) {
    if (!selectedCycle) return;
    setBusy(true);
    setError(null);
    try {
      const workout = await createWorkout(title?.trim() || "Workout");
      const res = await fetch(
        `/api/workout-cycles/${selectedCycle.id}/days/${selectedDay}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trainingLocation: location, workoutId: workout.id }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(formatApiErrorDetail(data.detail) || "Assign failed");
      }
      await refresh();
      window.location.href = `/admin/workouts/${workout.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
      setBusy(false);
    }
  }

  async function removeSlot(location: "gym" | "home", workoutId: string) {
    if (!selectedCycle) return;
    if (!window.confirm("Delete this workout from the cycle day and remove it from the library?")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workout-cycles/${selectedCycle.id}/days/${selectedDay}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ removeLocation: location, workoutId }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(formatApiErrorDetail(data.detail) || "Delete failed");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function markDayOff() {
    if (!selectedCycle) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/workout-cycles/${selectedCycle.id}/days/${selectedDay}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDayOff: true, notes: "Day Off" }),
        },
      );
      if (!res.ok) throw new Error("Update failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function createNewCycle(library = true) {
    const name = newCycleName.trim() || `28-day cycle ${new Date().toLocaleDateString()}`;
    setBusy(true);
    try {
      const res = await fetch("/api/workout-cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          library
            ? { name }
            : { name, programSlug, cycleMonth: 1 },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail) || "Create failed");
      setNewCycleName("");
      setSelectedCycleId(data.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyCycle(targetMonth?: number) {
    if (!selectedCycle) return;
    const name = window.prompt(
      "Name for the copied 28-day cycle:",
      `${selectedCycle.name} (copy)`,
    );
    if (!name?.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/workout-cycles/${selectedCycle.id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          programSlug: targetMonth ? programSlug : undefined,
          cycleMonth: targetMonth ?? null,
          deepCloneWorkouts: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail) || "Copy failed");
      setSelectedCycleId(data.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setBusy(false);
    }
  }

  async function deployToProgram(month: number) {
    if (!selectedCycle) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/workout-cycles/${selectedCycle.id}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug, cycleMonth: month }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail) || "Deploy failed");
      setSelectedCycleId(data.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deploy failed");
    } finally {
      setBusy(false);
    }
  }

  function slotFor(location: "gym" | "home"): CycleSlot | null {
    return selectedCycleDay?.slots.find((s) => s.trainingLocation === location) ?? null;
  }

  function renderSlot(location: "gym" | "home") {
    const slot = slotFor(location);
    const locationLabel = formatTrainingLocationLabel(location) || location;
    const title = slot ? workoutContentTitle(slot.workout.name) : null;
    const exerciseCount = slot?.workout._count?.exercises ?? 0;

    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300">
              {locationLabel}
            </p>
            {title ? (
              <>
                <p className="mt-0.5 font-medium">{title}</p>
                <p className="text-xs text-[var(--muted)]">{exerciseCount} exercises</p>
              </>
            ) : (
              <p className="mt-0.5 text-sm text-[var(--muted)]">No workout assigned</p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            {slot ? (
              <>
                <Link href={`/admin/workouts/${slot.workoutId}`} className="btn-ghost px-2 py-1 text-xs">
                  Edit
                </Link>
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs text-[var(--danger)]"
                  disabled={busy}
                  onClick={() => void removeSlot(location, slot.workoutId)}
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-primary px-2 py-1 text-xs"
                disabled={busy || !!selectedCycleDay?.isDayOff}
                onClick={() => void assignToSlot(location, newWorkoutTitle || undefined)}
              >
                + Add
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const allCycles = useMemo(() => {
    const seen = new Set<string>();
    const out: WorkoutCycle[] = [];
    for (const c of [...cycles, ...libraryCycles]) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
    return out;
  }, [cycles, libraryCycles]);

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[var(--muted)]">Program</span>
            <select
              className="input py-1.5"
              value={programSlug}
              disabled={busy}
              onChange={(e) => setProgramSlug(e.target.value)}
            >
              {programs.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="shrink-0 text-[var(--muted)]">28-day cycle</span>
            <select
              className="input min-w-0 flex-1 py-1.5"
              value={selectedCycleId ?? ""}
              disabled={busy || loading}
              onChange={(e) => setSelectedCycleId(e.target.value || null)}
            >
              <option value="" disabled>
                Select cycle…
              </option>
              {cycles.length > 0 && (
                <optgroup label="On program">
                  {cycles.filter((c) => c.programId).map((c) => (
                    <option key={c.id} value={c.id}>
                      {cycleLabel(c)}
                    </option>
                  ))}
                </optgroup>
              )}
              {libraryCycles.length > 0 && (
                <optgroup label="Library">
                  {libraryCycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {cycleLabel(c)}
                    </option>
                  ))}
                </optgroup>
              )}
              {allCycles.length === 0 && <option value="">No cycles yet</option>}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input min-w-[12rem] flex-1"
            placeholder="New cycle name"
            value={newCycleName}
            onChange={(e) => setNewCycleName(e.target.value)}
            disabled={busy}
          />
          <button
            type="button"
            className="btn-ghost text-sm"
            disabled={busy}
            onClick={() => void createNewCycle(true)}
          >
            + Library cycle
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={busy}
            onClick={() => void copyCycle()}
          >
            Copy cycle
          </button>
          {selectedCycle && !selectedCycle.programId && (
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={busy}
              onClick={() => void deployToProgram(1)}
            >
              Deploy to M1
            </button>
          )}
          {selectedCycle?.programId && selectedCycle.cycleMonth && (
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={busy}
              onClick={() => void copyCycle((selectedCycle.cycleMonth ?? 1) + 1)}
            >
              Copy to next month
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input min-w-[12rem] flex-1"
            placeholder="Workout title for + Add (e.g. Full body)"
            value={newWorkoutTitle}
            onChange={(e) => setNewWorkoutTitle(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <TextUploadPanel mode="workout" onBuilt={() => void refresh()} collapsible defaultOpen={false} />

      <div className="flex min-h-[36rem] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <aside className="w-40 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--surface-2)] sm:w-48">
          <p className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            M{selectedCycle?.cycleMonth ?? 1} · 28 days
          </p>
          <ul className="py-1">
            {Array.from({ length: PROGRAM_CYCLE_DAYS }, (_, i) => i + 1).map((dayNum) => {
              const day = selectedCycle?.days.find((d) => d.dayNumber === dayNum);
              const hasContent =
                day && (day.isDayOff || day.slots.some((s) => s.workoutId));
              const weekday = DAY_LABELS[(dayNum - 1) % 7];
              const isSelected = selectedDay === dayNum;
              return (
                <li key={dayNum}>
                  <button
                    type="button"
                    className={`flex w-full flex-col items-start px-3 py-2 text-left text-xs transition ${
                      isSelected
                        ? "bg-accent/15 text-accent"
                        : "hover:bg-[var(--surface)]"
                    }`}
                    disabled={!selectedCycle}
                    onClick={() => setSelectedDay(dayNum)}
                  >
                    <span className="font-semibold">
                      {mDayKey(selectedCycle?.cycleMonth, dayNum)}
                    </span>
                    <span className="text-[10px] text-[var(--muted)]">{weekday}</span>
                    {hasContent && (
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : !selectedCycle ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--muted)]">
                Create a 28-day cycle in the library, then assign workouts day by day.
              </p>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => void createNewCycle(true)}
              >
                + New library cycle
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">
                    {mDayKey(selectedCycle.cycleMonth, selectedDay)}
                  </h2>
                  <p className="text-sm text-[var(--muted)]">
                    {DAY_LABELS[(selectedDay - 1) % 7]}
                    {selectedCycleDay?.isDayOff && (
                      <span className="ml-2 text-amber-300">· Day off</span>
                    )}
                    <span className="ml-2 text-sky-300/80">· {selectedCycle.name}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/programs/${programSlug}`}
                    className="btn-ghost text-xs"
                  >
                    Full calendar →
                  </Link>
                  {!selectedCycleDay?.isDayOff && (
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      disabled={busy}
                      onClick={() => void markDayOff()}
                    >
                      Mark day off
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {renderSlot("gym")}
                {renderSlot("home")}
              </div>

              <p className="text-xs text-[var(--muted)]">
                Copy this cycle to the next month (deep-clones every workout so you can change reps
                independently), or deploy a library cycle onto a program month.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}