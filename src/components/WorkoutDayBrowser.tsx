"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  programId?: string | null;
  cycleMonth?: number | null;
  days: CycleDay[];
};

type ProgramSummary = { slug: string; name: string };

const fetchOpts: RequestInit = { credentials: "include" };

function cycleLabel(cycle: WorkoutCycle): string {
  if (cycle.programId && cycle.cycleMonth) return `${cycle.name} · M${cycle.cycleMonth}`;
  return `${cycle.name} · Library`;
}

function mDayKey(cycleMonth: number | null | undefined, dayNumber: number): string {
  return cycleDayKey(cycleMonth ?? 1, dayNumber);
}

function ActionButton({
  children,
  variant = "default",
  type = "button",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "danger" | "default";
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-40";
  const styles =
    variant === "primary"
      ? "bg-accent text-white hover:opacity-90"
      : variant === "danger"
        ? "border border-red-500/60 bg-red-950/40 text-red-300 hover:bg-red-950/70"
        : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-accent/60";
  return (
    <button type={type} className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

function ActionLink({
  children,
  href,
  variant = "default",
}: {
  children: React.ReactNode;
  href: string;
  variant?: "primary" | "default";
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition";
  const styles =
    variant === "primary"
      ? "bg-accent text-white hover:opacity-90"
      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-accent/60";
  return (
    <Link href={href} className={`${base} ${styles}`}>
      {children}
    </Link>
  );
}

export default function WorkoutDayBrowser() {
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [programSlug, setProgramSlug] = useState("adult");
  const [cycles, setCycles] = useState<WorkoutCycle[]>([]);
  const [libraryCycles, setLibraryCycles] = useState<WorkoutCycle[]>([]);
  const [workoutLibrary, setWorkoutLibrary] = useState<WorkoutRef[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCycleName, setNewCycleName] = useState("");
  const [newWorkoutTitle, setNewWorkoutTitle] = useState("");
  const [showLibrary, setShowLibrary] = useState(true);
  const [uploadHighlightDay, setUploadHighlightDay] = useState<number | null>(null);

  const selectedCycle = useMemo(() => {
    const fromList =
      cycles.find((c) => c.id === selectedCycleId) ??
      libraryCycles.find((c) => c.id === selectedCycleId);
    return fromList ?? null;
  }, [cycles, libraryCycles, selectedCycleId]);

  const selectedCycleDay = useMemo(() => {
    if (!selectedCycle?.days?.length) return null;
    return selectedCycle.days.find((d) => d.dayNumber === selectedDay) ?? null;
  }, [selectedCycle, selectedDay]);

  const loadWorkoutLibrary = useCallback(async () => {
    const res = await fetch("/api/workouts", fetchOpts);
    if (res.ok) setWorkoutLibrary(await res.json());
  }, []);

  const loadCycleDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/workout-cycles/${id}`, fetchOpts);
    if (!res.ok) return null;
    return (await res.json()) as WorkoutCycle;
  }, []);

  const loadCycles = useCallback(
    async (slug: string, ensureMonth1 = false) => {
      let progRes = await fetch(`/api/workout-cycles?program=${encodeURIComponent(slug)}`, fetchOpts);
      if (!progRes.ok) {
        const data = await progRes.json().catch(() => ({}));
        throw new Error(formatApiErrorDetail(data.detail || data.error) || "Could not load cycles");
      }
      let progCycles = (await progRes.json()) as WorkoutCycle[];

      if (ensureMonth1 && !progCycles.some((c) => c.cycleMonth === 1)) {
        const createRes = await fetch("/api/workout-cycles", {
          ...fetchOpts,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${slug} · Month 1`,
            programSlug: slug,
            cycleMonth: 1,
          }),
        });
        if (createRes.ok) {
          progRes = await fetch(`/api/workout-cycles?program=${encodeURIComponent(slug)}`, fetchOpts);
          progCycles = progRes.ok ? await progRes.json() : progCycles;
        }
      }

      const libRes = await fetch("/api/workout-cycles?library=1", fetchOpts);
      const lib = libRes.ok ? ((await libRes.json()) as WorkoutCycle[]) : [];

      const detailed = await Promise.all(
        [...progCycles, ...lib].map(async (c) => (await loadCycleDetail(c.id)) ?? c),
      );
      const progIds = new Set(progCycles.map((c) => c.id));
      setCycles(detailed.filter((c) => progIds.has(c.id)));
      setLibraryCycles(detailed.filter((c) => !progIds.has(c.id)));
      return { progCycles: detailed.filter((c) => progIds.has(c.id)), lib: detailed.filter((c) => !progIds.has(c.id)) };
    },
    [loadCycleDetail],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const progListRes = await fetch("/api/programs", fetchOpts);
      if (progListRes.ok) setPrograms(await progListRes.json());

      const { progCycles, lib } = await loadCycles(programSlug, true);
      await loadWorkoutLibrary();

      const all = [...progCycles, ...lib];
      let nextId = selectedCycleId;
      if (!nextId || !all.some((c) => c.id === nextId)) {
        nextId =
          progCycles.find((c) => c.cycleMonth === 1)?.id ??
          progCycles[0]?.id ??
          lib[0]?.id ??
          null;
        setSelectedCycleId(nextId);
      }

      if (nextId) {
        const full = await loadCycleDetail(nextId);
        if (full) {
          setCycles((prev) => prev.map((c) => (c.id === full.id ? full : c)));
          setLibraryCycles((prev) => prev.map((c) => (c.id === full.id ? full : c)));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [loadCycleDetail, loadCycles, loadWorkoutLibrary, programSlug, selectedCycleId]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programSlug]);

  useEffect(() => {
    if (!selectedCycleId) return;
    void loadCycleDetail(selectedCycleId).then((full) => {
      if (!full) return;
      setCycles((prev) => prev.map((c) => (c.id === full.id ? full : c)));
      setLibraryCycles((prev) => prev.map((c) => (c.id === full.id ? full : c)));
    });
  }, [selectedCycleId, selectedDay, loadCycleDetail]);

  async function createWorkout(name: string) {
    const res = await fetch("/api/workouts", {
      ...fetchOpts,
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

  async function handleAddWorkout(e: FormEvent) {
    e.preventDefault();
    if (!newWorkoutTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const workout = await createWorkout(newWorkoutTitle);
      setNewWorkoutTitle("");
      window.location.href = `/admin/workouts/${workout.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setBusy(false);
    }
  }

  async function deleteWorkoutById(workoutId: string, label: string) {
    if (!window.confirm(`Delete "${label}" permanently? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workouts/${workoutId}`, { ...fetchOpts, method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(formatApiErrorDetail(data.detail) || "Delete failed");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function assignToSlot(location: "gym" | "home", workoutId?: string, title?: string) {
    if (!selectedCycle) {
      setError("Select a 28-day cycle first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const libRes = await fetch("/api/workouts", fetchOpts);
      const freshLibrary = libRes.ok ? ((await libRes.json()) as WorkoutRef[]) : workoutLibrary;
      setWorkoutLibrary(freshLibrary);

      let id = workoutId;
      if (!id) {
        const workout = await createWorkout(title?.trim() || "Workout");
        id = workout.id;
      } else if (!freshLibrary.some((w) => w.id === id)) {
        throw new Error(
          "That workout is no longer in the library (it may have been merged). Refresh and choose again.",
        );
      }
      const res = await fetch(
        `/api/workout-cycles/${selectedCycle.id}/days/${selectedDay}`,
        {
          ...fetchOpts,
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trainingLocation: location, workoutId: id }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(formatApiErrorDetail(data.detail) || "Assign failed");
      }
      await refresh();
      if (!workoutId) window.location.href = `/admin/workouts/${id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeSlot(location: "gym" | "home", workoutId: string, title: string) {
    if (!selectedCycle) return;
    if (!window.confirm(`Remove "${title}" from ${location} on this day? The workout stays in your library.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/workout-cycles/${selectedCycle.id}/days/${selectedDay}`,
        {
          ...fetchOpts,
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ removeLocation: location, workoutId }),
        },
      );
      if (!res.ok) throw new Error("Remove failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  async function createNewCycle(library = true) {
    const name = newCycleName.trim() || `28-day cycle ${new Date().toLocaleDateString()}`;
    setBusy(true);
    try {
      const res = await fetch("/api/workout-cycles", {
        ...fetchOpts,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(library ? { name } : { name, programSlug, cycleMonth: 1 }),
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

  function slotFor(location: "gym" | "home"): CycleSlot | null {
    return selectedCycleDay?.slots.find((s) => s.trainingLocation === location) ?? null;
  }

  function renderSlot(location: "gym" | "home") {
    const slot = slotFor(location);
    const locationLabel = formatTrainingLocationLabel(location) || location;
    const title = slot ? workoutContentTitle(slot.workout?.name) : null;
    const exerciseCount = slot?.workout?._count?.exercises ?? 0;

    return (
      <div className="rounded-xl border-2 border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-violet-300">{locationLabel}</p>
        {title ? (
          <>
            <p className="mt-2 text-lg font-semibold">{title}</p>
            <p className="text-sm text-[var(--muted)]">{exerciseCount} exercises</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionLink href={`/admin/workouts/${slot!.workoutId}`} variant="primary">
                Edit workout
              </ActionLink>
              <ActionButton
                variant="danger"
                disabled={busy}
                onClick={() => void removeSlot(location, slot!.workoutId, title)}
              >
                Remove from day
              </ActionButton>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-[var(--muted)]">No workout on this day</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton
                variant="primary"
                disabled={busy || !!selectedCycleDay?.isDayOff || !selectedCycle}
                onClick={() => void assignToSlot(location, undefined, newWorkoutTitle || undefined)}
              >
                + Add new workout
              </ActionButton>
            </div>
            {workoutLibrary.length > 0 && !selectedCycleDay?.isDayOff && selectedCycle && (
              <label className="mt-3 block text-xs text-[var(--muted)]">
                Or assign existing
                <select
                  className="input mt-1 w-full text-sm"
                  defaultValue=""
                  disabled={busy}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) void assignToSlot(location, id);
                    e.target.value = "";
                  }}
                >
                  <option value="">Choose from library…</option>
                  {workoutLibrary.map((w) => (
                    <option key={w.id} value={w.id}>
                      {workoutContentTitle(w.name)} ({w._count?.exercises ?? 0} ex)
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
      </div>
    );
  }

  const allCycles = useMemo(() => {
    const seen = new Set<string>();
    return [...cycles, ...libraryCycles].filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [cycles, libraryCycles]);

  return (
    <div className="space-y-5">
      <form onSubmit={handleAddWorkout} className="card flex flex-wrap items-center gap-3">
        <input
          className="input min-w-[14rem] flex-1"
          placeholder="New workout title (e.g. Full body)"
          value={newWorkoutTitle}
          onChange={(e) => setNewWorkoutTitle(e.target.value)}
          disabled={busy}
        />
        <ActionButton variant="primary" disabled={busy || !newWorkoutTitle.trim()} type="submit">
          + Add workout
        </ActionButton>
      </form>

      <div className="card flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Program</span>
          <select
            className="input py-2"
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
        <label className="min-w-[14rem] flex-1 text-sm">
          <span className="mb-1 block text-[var(--muted)]">28-day cycle</span>
          <select
            className="input w-full py-2"
            value={selectedCycleId ?? ""}
            disabled={busy || loading}
            onChange={(e) => setSelectedCycleId(e.target.value || null)}
          >
            {allCycles.length === 0 && <option value="">Loading cycles…</option>}
            {cycles.filter((c) => c.programId).length > 0 && (
              <optgroup label="On program">
                {cycles
                  .filter((c) => c.programId)
                  .map((c) => (
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
          </select>
        </label>
        <ActionButton disabled={busy} onClick={() => void createNewCycle(true)}>
          + New cycle
        </ActionButton>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border-2 border-[var(--border)] bg-[var(--surface)]">
        <div className="flex min-h-[28rem] flex-col lg:flex-row">
          <aside className="w-full shrink-0 border-b border-[var(--border)] bg-[var(--surface-2)] lg:w-52 lg:border-b-0 lg:border-r">
            <p className="border-b border-[var(--border)] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              {selectedCycle ? mDayKey(selectedCycle.cycleMonth, 1).replace(/D\d+$/, "") : "M1"} ·
              28 days
            </p>
            <ul className="grid grid-cols-4 gap-0 sm:grid-cols-7 lg:grid-cols-1 lg:gap-0">
              {Array.from({ length: PROGRAM_CYCLE_DAYS }, (_, i) => i + 1).map((dayNum) => {
                const day = selectedCycle?.days?.find((d) => d.dayNumber === dayNum);
                const hasContent =
                  day && (day.isDayOff || day.slots.some((s) => s.workoutId));
              const isSelected = selectedDay === dayNum;
              const isUploadTarget = uploadHighlightDay === dayNum;
              return (
                <li key={dayNum}>
                  <button
                    type="button"
                    className={`flex w-full flex-col px-3 py-2.5 text-left text-xs transition lg:py-2 ${
                      isUploadTarget
                        ? "ring-2 ring-inset ring-sky-400 bg-sky-950/50"
                        : isSelected
                          ? "bg-accent text-white"
                          : "hover:bg-[var(--surface)]"
                    }`}
                    onClick={() => {
                      setSelectedDay(dayNum);
                      setUploadHighlightDay(null);
                    }}
                  >
                    <span className="font-bold">
                      {mDayKey(selectedCycle?.cycleMonth, dayNum)}
                    </span>
                    <span
                      className={
                        isSelected && !isUploadTarget
                          ? "text-white/80"
                          : "text-[var(--muted)]"
                      }
                    >
                      {DAY_LABELS[(dayNum - 1) % 7]}
                    </span>
                    {isUploadTarget && (
                      <span className="mt-0.5 text-[9px] font-bold uppercase text-sky-300">
                        ↑ upload here
                      </span>
                    )}
                    {hasContent && !isSelected && !isUploadTarget && (
                      <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                    )}
                  </button>
                </li>
              );
              })}
            </ul>
          </aside>

          <section className="min-w-0 flex-1 p-4 lg:p-6">
            {loading ? (
              <p className="text-[var(--muted)]">Loading cycle…</p>
            ) : (
              <>
                <div className="mb-4">
                  <h2 className="text-xl font-bold">
                    {mDayKey(selectedCycle?.cycleMonth, selectedDay)}
                    <span className="ml-2 text-base font-normal text-[var(--muted)]">
                      {DAY_LABELS[(selectedDay - 1) % 7]}
                    </span>
                  </h2>
                  {selectedCycle && (
                    <p className="text-sm text-sky-300/90">{selectedCycle.name}</p>
                  )}
                </div>
                <TextUploadPanel
                  mode="workout"
                  collapsible
                  defaultOpen
                  cycleContext={
                    selectedCycle
                      ? {
                          cycleId: selectedCycle.id,
                          cycleMonth: selectedCycle.cycleMonth ?? 1,
                          cycleName: selectedCycle.name,
                          selectedDay,
                        }
                      : null
                  }
                  onTargetDayChange={(day) => {
                    setUploadHighlightDay(day);
                    if (day != null) setSelectedDay(day);
                  }}
                  onBuilt={() => {
                    setUploadHighlightDay(null);
                    void refresh();
                  }}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  {renderSlot("gym")}
                  {renderSlot("home")}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <div className="card">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setShowLibrary((v) => !v)}
        >
          <span className="text-lg font-semibold">Workout library</span>
          <span className="text-sm text-[var(--muted)]">{showLibrary ? "Hide" : "Show"} · {workoutLibrary.length}</span>
        </button>
        {showLibrary && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="pb-2 pr-4 font-semibold">Title</th>
                  <th className="pb-2 pr-4 font-semibold">Exercises</th>
                  <th className="pb-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workoutLibrary.map((w) => {
                  const title = workoutContentTitle(w.name);
                  return (
                    <tr key={w.id} className="border-b border-[var(--border)]/60">
                      <td className="py-3 pr-4 font-medium">{title}</td>
                      <td className="py-3 pr-4 text-[var(--muted)]">{w._count?.exercises ?? 0}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <ActionLink href={`/admin/workouts/${w.id}`} variant="primary">
                            Edit
                          </ActionLink>
                          <ActionButton
                            variant="danger"
                            disabled={busy}
                            onClick={() => void deleteWorkoutById(w.id, title)}
                          >
                            Delete
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {workoutLibrary.length === 0 && (
              <p className="py-4 text-[var(--muted)]">No workouts yet — use + Add workout above.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}