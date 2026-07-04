"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import WorkoutCertifyPanel from "@/components/WorkoutCertifyPanel";
import { workoutItemsToParsedSms } from "@/lib/workout-builder-export";
import ExerciseCascadePicker, {
  type WorkoutExerciseConfig,
} from "@/components/ExerciseCascadePicker";
import { formatApiErrorDetail } from "@/lib/api-errors";
import {
  approachLabel,
  formatPrescriptionSummary,
  normalizePrescription,
  weightTierLabel,
  type WeightTierId,
} from "@/lib/workout-schemes";

type Exercise = {
  id: string;
  name: string;
  videoUrl: string | null;
};

type WorkoutItem = {
  id: string;
  sortOrder: number;
  setScheme: string | null;
  repPattern: string | null;
  reps: string | null;
  sets: number | null;
  weightTier: string | null;
  notes: string | null;
  exercise: Exercise;
};

type Workout = {
  id: string;
  name: string;
  description: string | null;
  exportText?: string | null;
  certifiedAt?: string | null;
  exercises: WorkoutItem[];
};

function isWorkoutPayload(data: unknown): data is Workout {
  return (
    !!data &&
    typeof data === "object" &&
    "id" in data &&
    "name" in data &&
    Array.isArray((data as Workout).exercises)
  );
}

export default function WorkoutBuilder({ workoutId }: { workoutId: string }) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [pickId, setPickId] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [persistenceNote, setPersistenceNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const maxAttempts = workoutId.startsWith("new-w-") ? 4 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const [wRes, eRes] = await Promise.all([
        fetch(`/api/workouts/${workoutId}`, { cache: "no-store" }),
        fetch("/api/exercises", { cache: "no-store" }),
      ]);

      if (eRes.ok) {
        setLibrary(await eRes.json());
      }

      const body = await wRes.json().catch(() => null);
      if (wRes.ok && isWorkoutPayload(body)) {
        setWorkout(body);
        setLoading(false);
        return;
      }

      const detail =
        formatApiErrorDetail((body as { detail?: unknown } | null)?.detail) ||
        (wRes.status === 404 ? "Workout not found — it may still be saving." : "Could not load workout.");

      if (attempt < maxAttempts - 1 && wRes.status === 404) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }

      setWorkout(null);
      setLoadError(detail);
      setLoading(false);
      return;
    }
  }, [workoutId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    fetch("/api/admin/demo-persistence", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.demoMode && data.message) setPersistenceNote(data.message);
      })
      .catch(() => {});
  }, []);

  const saveExerciseConfig = useCallback(
    async (
      exerciseId: string,
      config: WorkoutExerciseConfig,
      itemId?: string,
    ) => {
      setSaveError(null);
      setSaveMessage(null);
      const payload = {
        setScheme: config.setScheme,
        repPattern: config.repPattern,
        reps: config.reps,
        sets: config.setCount,
        weightTier: config.weightTier,
        notes: config.notes,
      };

      const res = await fetch(`/api/workouts/${workoutId}/exercises`, {
        method: itemId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          itemId ? { itemId, ...payload } : { exerciseId, ...payload },
        ),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          detail?: unknown;
        } | null;
        setSaveError(formatApiErrorDetail(body?.detail));
        return;
      }

      const saved = (await res.json()) as WorkoutItem;
      setWorkout((prev) => {
        if (!prev) return prev;
        if (itemId) {
          return {
            ...prev,
            exercises: prev.exercises.map((row) =>
              row.id === itemId ? { ...row, ...saved, exercise: saved.exercise ?? row.exercise } : row,
            ),
          };
        }
        return { ...prev, exercises: [...prev.exercises, saved] };
      });

      if (itemId) {
        setEditingItemId(null);
        setSaveMessage(`Updated “${saved.exercise?.name ?? "exercise"}”.`);
      } else {
        setPickId("");
        setSaveMessage(`Added “${saved.exercise?.name ?? "exercise"}”.`);
      }
    },
    [workoutId],
  );

  async function removeItem(itemId: string) {
    const item = workout?.exercises.find((row) => row.id === itemId);
    if (
      item &&
      !confirm(`Remove “${item.exercise.name}” from this workout?`)
    ) {
      return;
    }
    setSaveError(null);
    setSaveMessage(null);
    const res = await fetch(
      `/api/workouts/${workoutId}/exercises?itemId=${encodeURIComponent(itemId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        detail?: unknown;
      } | null;
      setSaveError(
        formatApiErrorDetail(body?.detail) ||
          "Could not remove exercise — try again.",
      );
      return;
    }
    if (editingItemId === itemId) {
      setEditingItemId(null);
    }
    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.filter((row) => row.id !== itemId),
          }
        : prev,
    );
    setSaveMessage(
      item ? `Removed “${item.exercise.name}”.` : "Exercise removed.",
    );
  }

  async function saveWorkoutName(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !workout || trimmed === workout.name) return;
    setSavingName(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/workouts/${workoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          detail?: unknown;
        } | null;
        setSaveError(formatApiErrorDetail(body?.detail));
        return;
      }
      const updated = await res.json();
      setWorkout((prev) => (prev ? { ...prev, name: updated.name ?? trimmed } : prev));
      setSaveMessage(`Workout renamed to “${updated.name ?? trimmed}”.`);
    } finally {
      setSavingName(false);
    }
  }

  const parsedForExport = useMemo(
    () => (workout ? workoutItemsToParsedSms(workout) : null),
    [workout],
  );

  const pickedExercise = library.find((e) => e.id === pickId);
  const editingItem = workout?.exercises.find((i) => i.id === editingItemId);

  if (loading) {
    return <p className="text-[var(--muted)]">Loading workout…</p>;
  }

  if (loadError || !workout) {
    return (
      <div className="space-y-4">
        <Link href="/admin/workouts" className="text-sm text-accent hover:underline">
          ← All workouts
        </Link>
        <div className="card border-[var(--danger)]/40">
          <p className="font-semibold text-[var(--danger)]">Could not open this workout</p>
          <p className="mt-2 text-sm text-[var(--muted)]">{loadError}</p>
          <button type="button" className="btn-primary mt-4" onClick={() => void load()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/workouts" className="text-sm text-accent hover:underline">
        ← All workouts
      </Link>

      {persistenceNote && (
        <div
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--muted)]"
          role="status"
        >
          <p className="font-medium text-[var(--text)]">How workout edits are saved</p>
          <p className="mt-1">{persistenceNote}</p>
          <p className="mt-2 text-xs">
            Add, edit setup, remove, and rename all update the workout library and program day
            previews. Refresh once if a change looks stale.
          </p>
        </div>
      )}

      <div>
        <input
          className="w-full max-w-xl border-0 bg-transparent p-0 text-2xl font-bold outline-none focus:ring-0"
          defaultValue={workout.name}
          aria-label="Workout name"
          disabled={savingName}
          onBlur={(e) => void saveWorkoutName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <p className="mt-1 text-sm text-[var(--muted)]">
          {workout.exercises.length} exercise{workout.exercises.length === 1 ? "" : "s"} · tap name to rename
        </p>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[12rem] flex-1 text-sm">
            <span className="font-medium">Add from library</span>
            <select
              className="input mt-1.5"
              value={pickId}
              onChange={(e) => {
                setPickId(e.target.value);
                setEditingItemId(null);
                setSaveError(null);
              }}
            >
              <option value="">Select exercise…</option>
              {library.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </label>
          <Link href="/admin/exercises" className="btn-ghost shrink-0 text-sm">
            + New in library
          </Link>
        </div>

        {pickedExercise && !editingItemId && (
          <ExerciseCascadePicker
            exerciseName={pickedExercise.name}
            onConfirm={(config) => saveExerciseConfig(pickedExercise.id, config)}
            onCancel={() => setPickId("")}
          />
        )}

        {editingItem && (
          <ExerciseCascadePicker
            exerciseName={editingItem.exercise.name}
            initialScheme={editingItem.setScheme}
            initialRepPattern={editingItem.repPattern}
            initialReps={editingItem.reps}
            initialSetCount={editingItem.sets ?? undefined}
            initialTier={(editingItem.weightTier as WeightTierId) ?? undefined}
            initialNotes={editingItem.notes}
            confirmLabel="Save changes"
            onConfirm={(config) =>
              saveExerciseConfig(editingItem.exercise.id, config, editingItem.id)
            }
            onCancel={() => setEditingItemId(null)}
          />
        )}
      </div>

      {saveMessage && (
        <p
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)]"
          role="status"
        >
          {saveMessage}
        </p>
      )}

      {saveError && (
        <p className="rounded-lg border border-[var(--danger)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--danger)]">
          {saveError}
        </p>
      )}

      <ul className="space-y-2">
        {workout.exercises.map((item, index) => (
          <li
            key={item.id}
            className="card flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                <span className="mr-2 text-xs text-[var(--muted)]">{index + 1}.</span>
                {item.exercise.name}
              </p>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {approachLabel(normalizePrescription(item).approach)} ·{" "}
                {formatPrescriptionSummary(item)} · {weightTierLabel(item.weightTier)}
              </p>
              {item.notes && (
                <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">{item.notes}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => {
                  setPickId("");
                  setEditingItemId(item.id);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="text-sm text-[var(--danger)]"
                onClick={() => removeItem(item.id)}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
        {workout.exercises.length === 0 && !pickId && (
          <p className="text-sm text-[var(--muted)]">
            No exercises yet — pick one from the library above.
          </p>
        )}
      </ul>

      {parsedForExport && (
        <WorkoutCertifyPanel
          workoutId={workoutId}
          parsedWorkout={parsedForExport}
          savedExportText={workout.exportText}
          savedCertifiedAt={workout.certifiedAt}
          defaultOpen={
            !workout.certifiedAt &&
            (workout.description?.toLowerCase().includes("text upload") ?? false)
          }
          onCertified={(exportText) => {
            setWorkout((prev) =>
              prev
                ? {
                    ...prev,
                    exportText,
                    certifiedAt: new Date().toISOString(),
                  }
                : prev,
            );
            setSaveMessage("Certified — download or copy the export text; use the same format for future uploads.");
          }}
        />
      )}
    </div>
  );
}