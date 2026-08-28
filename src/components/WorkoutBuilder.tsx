"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WorkoutCertifyPanel from "@/components/WorkoutCertifyPanel";
import { workoutItemsToParsedSms } from "@/lib/workout-builder-export";
import PrescriptionRowEditor from "@/components/PrescriptionRowEditor";
import { formatApiErrorDetail } from "@/lib/api-errors";
import { legacyWorkoutItemToPrescriptionDraft } from "@/lib/prescription-from-legacy";
import { prescriptionToLegacy } from "@/lib/prescription-to-legacy";
import { DEFAULT_REST_TIMER_SECONDS } from "@/lib/rest-timer";
import type { PrescriptionDraft } from "@/lib/prescription-example-types";
import {
  approachLabel,
  formatPrescriptionSummary,
  normalizePrescription,
  weightTierLabel,
} from "@/lib/workout-schemes";
import { notesMarkWarmup, withWarmupBlockNote } from "@/lib/warmup-group";
import { isStandardWarmupWorkoutId } from "@/lib/warmup-template";

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
  source?: string | null;
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

export default function WorkoutBuilder({
  workoutId,
  embedded = false,
  onContinue,
  continueLabel = "Continue to assign class →",
  headerNote,
}: {
  workoutId: string;
  embedded?: boolean;
  onContinue?: () => void;
  continueLabel?: string;
  headerNote?: React.ReactNode;
}) {
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
  const [addAsWarmup, setAddAsWarmup] = useState(() =>
    isStandardWarmupWorkoutId(workoutId),
  );
  const nameSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        if (data?.message) setPersistenceNote(data.message);
      })
      .catch(() => {});
  }, []);

  const savePrescriptionDraft = useCallback(
    async (
      exerciseId: string,
      draft: PrescriptionDraft & { summary: string },
      itemId?: string,
    ) => {
      setSaveError(null);
      setSaveMessage(null);
      const legacy = prescriptionToLegacy(draft);
      const payload = {
        setScheme: legacy.setScheme,
        repPattern: legacy.repPattern,
        reps: legacy.reps,
        sets: legacy.sets,
        weightTier: legacy.weightTier,
        restSec: legacy.restSec,
        notes: withWarmupBlockNote(legacy.notes, addAsWarmup),
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
        setAddAsWarmup(isStandardWarmupWorkoutId(workoutId));
        setSaveMessage(`Added “${saved.exercise?.name ?? "exercise"}”.`);
      }
    },
    [workoutId, addAsWarmup],
  );

  const defaultPrescriptionDraft = useCallback(
    (exerciseName: string) =>
      legacyWorkoutItemToPrescriptionDraft(
        {
          setScheme: "standard",
          reps: "10",
          sets: 3,
          restSec: DEFAULT_REST_TIMER_SECONDS,
          notes: null,
        },
        exerciseName,
      ),
    [],
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

  const saveWorkoutName = useCallback(async (name: string) => {
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
  }, [workout, workoutId]);

  useEffect(() => {
    return () => {
      if (nameSaveTimer.current) clearTimeout(nameSaveTimer.current);
    };
  }, []);

  function scheduleWorkoutNameSave(name: string) {
    if (nameSaveTimer.current) clearTimeout(nameSaveTimer.current);
    nameSaveTimer.current = setTimeout(() => {
      void saveWorkoutName(name);
    }, 900);
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
      {!embedded ? (
        <Link
          href={workout.source === "maintain" ? "/admin/maintain" : "/admin/workouts"}
          className="text-sm text-accent hover:underline"
        >
          {workout.source === "maintain" ? "← Quick maintain" : "← All workouts"}
        </Link>
      ) : null}

      {workout.source === "maintain" && !embedded ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-semibold text-amber-100">Quick maintain</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Members pick this on Today as an extra session (Business Class included). Change the
            title, add/remove exercises, sets, and demo videos here — then go back to the Quick
            maintain desk for muscle-group copy.
          </p>
        </div>
      ) : null}

      {headerNote}

      {persistenceNote && !embedded && (
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

      <div className="max-w-xl space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Workout title
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input min-w-0 flex-1 text-xl font-bold"
            defaultValue={workout.name}
            aria-label="Workout title"
            placeholder="e.g. Full body"
            disabled={savingName}
            onChange={(e) => scheduleWorkoutNameSave(e.target.value)}
            onBlur={(e) => {
              if (nameSaveTimer.current) clearTimeout(nameSaveTimer.current);
              void saveWorkoutName(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          {savingName && (
            <span className="text-sm text-[var(--muted)]">Saving…</span>
          )}
        </div>
        <p className="text-sm text-[var(--muted)]">
          {workout.exercises.length} exercise{workout.exercises.length === 1 ? "" : "s"}
          {embedded
            ? " · edits save automatically — this is today’s class workout"
            : " · content only — day (M1D2) and location (Gym/Home) live on the program cycle"}
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
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={addAsWarmup}
                onChange={(e) => setAddAsWarmup(e.target.checked)}
              />
              Warm-up movement (saved as its own exercise, grouped on the member card)
            </label>
            <PrescriptionRowEditor
              exerciseName={pickedExercise.name}
              initial={defaultPrescriptionDraft(pickedExercise.name)}
              confirmLabel="Add to workout"
              onConfirm={(draft) => savePrescriptionDraft(pickedExercise.id, draft)}
              onCancel={() => setPickId("")}
            />
          </>
        )}

        {editingItem && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={addAsWarmup}
                onChange={(e) => setAddAsWarmup(e.target.checked)}
              />
              Warm-up movement (saved as its own exercise, grouped on the member card)
            </label>
            <PrescriptionRowEditor
              exerciseName={editingItem.exercise.name}
              initial={legacyWorkoutItemToPrescriptionDraft(editingItem, editingItem.exercise.name)}
              confirmLabel="Save changes"
              onConfirm={(draft) =>
                savePrescriptionDraft(editingItem.exercise.id, draft, editingItem.id)
              }
              onCancel={() => setEditingItemId(null)}
            />
          </>
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
                {notesMarkWarmup(item.notes || "") ? (
                  <span className="ml-2 rounded-full bg-[color-mix(in_srgb,var(--ramp-gold)_22%,transparent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ramp-gold-light)]">
                    Warm-up
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {approachLabel(normalizePrescription(item).approach)} ·{" "}
                {formatPrescriptionSummary(item)} · {weightTierLabel(item.weightTier)}
              </p>
              {item.notes && (
                <p
                  className="mt-1 line-clamp-2 text-xs text-violet-300/90"
                  title={item.notes}
                >
                  <span className="font-semibold uppercase tracking-wide text-violet-400/80">
                    Coach note:{" "}
                  </span>
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
                  setAddAsWarmup(notesMarkWarmup(item.notes || ""));
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

      {parsedForExport && !embedded ? (
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
      ) : null}

      {embedded && onContinue ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
          <button type="button" onClick={onContinue} className="btn-primary px-4 py-2 text-sm">
            {continueLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}