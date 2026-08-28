"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AdminMaintainWorkout = {
  id: string;
  name: string;
  key: string | null;
  muscleGroup: string;
  blurb: string;
  exerciseCount: number;
  exercises: Array<{
    id: string;
    name: string;
    sets: number | null;
    reps: string | null;
    videoUrl: string | null;
  }>;
  updatedAt: string;
};

export default function AdminMaintainDesk() {
  const [workouts, setWorkouts] = useState<AdminMaintainWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { name: string; muscleGroup: string; blurb: string }>
  >({});
  const [newName, setNewName] = useState("");
  const [newMuscle, setNewMuscle] = useState("");
  const [newBlurb, setNewBlurb] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/maintain", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as {
      workouts?: AdminMaintainWorkout[];
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Could not load Quick maintain workouts.");
      setLoading(false);
      return;
    }
    const list = data.workouts || [];
    setWorkouts(list);
    setDrafts(
      Object.fromEntries(
        list.map((w) => [
          w.id,
          { name: w.name, muscleGroup: w.muscleGroup, blurb: w.blurb },
        ]),
      ),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMeta(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    setError(null);
    const res = await fetch(`/api/admin/maintain/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = (await res.json().catch(() => ({}))) as {
      workout?: AdminMaintainWorkout;
      error?: string;
    };
    setSavingId(null);
    if (!res.ok || !data.workout) {
      setError(data.error || "Save failed.");
      return;
    }
    setWorkouts((prev) => prev.map((w) => (w.id === id ? data.workout! : w)));
  }

  async function createWorkout() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/maintain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        muscleGroup: newMuscle.trim() || undefined,
        blurb: newBlurb.trim() || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    setCreating(false);
    if (!res.ok || !data.id) {
      setError(data.error || "Could not create workout.");
      return;
    }
    window.location.href = `/admin/workouts/${data.id}?from=maintain`;
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading Quick maintain library…</p>;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
        <h2 className="text-sm font-semibold">Add a Quick maintain workout</h2>
        <p className="text-xs text-[var(--muted)]">
          Creates an empty session. Then add/reorder exercises, sets, and demo videos in the
          workout editor — same builder as class days.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="input"
            placeholder="Name (e.g. Lower Body)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Muscle group (e.g. Quads · glutes)"
            value={newMuscle}
            onChange={(e) => setNewMuscle(e.target.value)}
          />
          <input
            className="input sm:col-span-2"
            placeholder="Short blurb members see on the card"
            value={newBlurb}
            onChange={(e) => setNewBlurb(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn-primary px-4 py-2 text-sm font-semibold"
          disabled={creating || !newName.trim()}
          onClick={() => void createWorkout()}
        >
          {creating ? "Creating…" : "Create & edit exercises"}
        </button>
      </section>

      <ul className="space-y-4">
        {workouts.map((w) => {
          const draft = drafts[w.id] || {
            name: w.name,
            muscleGroup: w.muscleGroup,
            blurb: w.blurb,
          };
          return (
            <li
              key={w.id}
              className="rounded-2xl border border-amber-500/25 bg-[var(--surface)] p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/90">
                  Quick maintain
                </p>
                <span className="text-[11px] text-[var(--muted)]">
                  {w.exerciseCount} exercise{w.exerciseCount === 1 ? "" : "s"}
                </span>
              </div>
              <label className="block text-xs text-[var(--muted)]">
                Title
                <input
                  className="input mt-1 w-full font-semibold"
                  value={draft.name}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [w.id]: { ...draft, name: e.target.value },
                    }))
                  }
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs text-[var(--muted)]">
                  Muscle group
                  <input
                    className="input mt-1 w-full"
                    value={draft.muscleGroup}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [w.id]: { ...draft, muscleGroup: e.target.value },
                      }))
                    }
                  />
                </label>
                <label className="block text-xs text-[var(--muted)] sm:col-span-1">
                  Member blurb
                  <input
                    className="input mt-1 w-full"
                    value={draft.blurb}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [w.id]: { ...draft, blurb: e.target.value },
                      }))
                    }
                  />
                </label>
              </div>
              <ol className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 px-3 py-2 text-sm">
                {w.exercises.length === 0 ? (
                  <li className="text-[var(--muted)]">No exercises yet — open the editor to add them.</li>
                ) : (
                  w.exercises.map((ex, i) => (
                    <li key={ex.id} className="flex flex-wrap justify-between gap-2">
                      <span>
                        {i + 1}. {ex.name}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {ex.sets ? `${ex.sets}×` : ""}
                        {ex.reps || ""}
                        {ex.videoUrl ? " · video" : ""}
                      </span>
                    </li>
                  ))
                )}
              </ol>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-sm font-semibold"
                  disabled={savingId === w.id}
                  onClick={() => void saveMeta(w.id)}
                >
                  {savingId === w.id ? "Saving…" : "Save title / blurb"}
                </button>
                <Link
                  href={`/admin/workouts/${w.id}?from=maintain`}
                  className="btn-primary px-3 py-1.5 text-sm font-semibold"
                >
                  Review &amp; edit exercises →
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
      {workouts.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No Quick maintain workouts yet.</p>
      ) : null}
    </div>
  );
}
