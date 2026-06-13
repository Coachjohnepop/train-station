"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
  exercises: WorkoutItem[];
};

export default function WorkoutBuilder({ workoutId }: { workoutId: string }) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [pickId, setPickId] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const autoAddedRef = useRef(false);

  const load = useCallback(async () => {
    const [wRes, eRes] = await Promise.all([
      fetch(`/api/workouts/${workoutId}`),
      fetch("/api/exercises"),
    ]);
    setWorkout(await wRes.json());
    setLibrary(await eRes.json());
  }, [workoutId]);

  useEffect(() => {
    load();
  }, [load]);

  const pickedExercise = library.find((e) => e.id === pickId);
  const editingItem = workout?.exercises.find((i) => i.id === editingItemId);

  async function saveExerciseConfig(
    exerciseId: string,
    config: WorkoutExerciseConfig,
    itemId?: string,
  ) {
    setSaveError(null);
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

    if (itemId) {
      setEditingItemId(null);
    } else {
      setPickId("");
    }
    await load();
  }

  async function removeItem(itemId: string) {
    setSaveError(null);
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
    await load();
  }

  // Auto-add standard warm-ups when a brand new workout is created with zero exercises.
  // This ensures warm-ups are always the first steps for any new workout (per client request).
  // Runs only once per empty workout load.
  useEffect(() => {
    if (
      workout &&
      workout.exercises.length === 0 &&
      library.length > 0 &&
      !autoAddedRef.current
    ) {
      autoAddedRef.current = true;
      const warmUps = library
        .filter((e) => /warm|mobility/i.test(e.name))
        .slice(0, 3);
      if (warmUps.length === 0) return;

      (async () => {
        // Attempt to persist via API (works for real DB; demo returns fake)
        for (const ex of warmUps) {
          try {
            await saveExerciseConfig(ex.id, {
              setScheme: "reps",
              repPattern: null,
              reps: "10",
              setCount: 1,
              weightTier: "light",
              notes: "Warm up - easy pace",
            });
          } catch {
            // non-fatal
          }
        }
        // For demo new workouts (where GET doesn't persist the added items), update local state directly
        // so the warm-ups appear immediately in the UI. Real DB will have them on next load.
        setWorkout((prev) => {
          if (!prev) return prev;
          const newItems = warmUps.map((ex, idx) => ({
            id: "auto-warm-" + Date.now() + "-" + idx,
            sortOrder: idx,
            setScheme: "reps",
            repPattern: null,
            reps: "10",
            sets: 1,
            weightTier: "light",
            notes: "Warm up - easy pace",
            exercise: ex,
          }));
          return { ...prev, exercises: newItems };
        });
      })();
    }
  }, [workout, library, load, saveExerciseConfig]);

  if (!workout) {
    return <p className="text-[var(--muted)]">Loading workout…</p>;
  }

  return (
    <div>
      <Link href="/admin/workouts" className="text-sm text-accent hover:underline">
        ← All workouts
      </Link>
      <h1 className="mt-4 text-2xl font-bold">{workout.name}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Pick a movement from the library (name + video only), then configure it
        here: approach (standard, drop sets, rest pause…), reps or pattern,
        set count, weight tier, and coaching notes.
      </p>

      <div className="card mt-6">
        <label className="text-sm font-medium">Add exercise from library</label>
        <select
          className="input mt-2"
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
              {ex.videoUrl ? " · has video" : ""}
            </option>
          ))}
        </select>
        <Link
          href="/admin/exercises"
          className="mt-2 inline-block text-sm text-accent hover:underline"
        >
          + New exercise in library
        </Link>
      </div>

      {saveError && (
        <p className="mt-4 rounded-lg border border-[var(--danger)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--danger)]">
          {saveError}
        </p>
      )}

      {pickedExercise && !editingItemId && (
        <div className="mt-4">
          <ExerciseCascadePicker
            exerciseName={pickedExercise.name}
            onConfirm={(config) =>
              saveExerciseConfig(pickedExercise.id, config)
            }
            onCancel={() => setPickId("")}
          />
        </div>
      )}

      {editingItem && (
        <div className="mt-4">
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
              saveExerciseConfig(
                editingItem.exercise.id,
                config,
                editingItem.id,
              )
            }
            onCancel={() => setEditingItemId(null)}
          />
        </div>
      )}

      <ul className="mt-8 space-y-3">
        {workout.exercises.map((item, index) => (
          <li
            key={item.id}
            className="card flex flex-wrap items-start justify-between gap-4"
          >
            <div className="min-w-0 flex-1">
              <span className="text-xs text-[var(--muted)]">#{index + 1}</span>
              <p className="font-semibold">{item.exercise.name}</p>
              {item.exercise.videoUrl && (
                <p className="mt-0.5 text-xs text-accent">Demo video in library</p>
              )}
              <p className="mt-2 text-sm text-accent-deep">
                {approachLabel(
                  normalizePrescription(item).approach,
                )}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {formatPrescriptionSummary(item)} ·{" "}
                {weightTierLabel(item.weightTier)}
              </p>
              {item.notes && (
                <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">
                  {item.notes}
                </p>
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
                Edit setup
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
          <p className="text-[var(--muted)]">
            No exercises yet. Select one above to configure this workout.
          </p>
        )}
      </ul>
    </div>
  );
}