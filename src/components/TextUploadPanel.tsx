"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatApiError } from "@/lib/api-errors";

export type TextUploadMode = "exercises" | "workout" | "program-week";

const PLACEHOLDERS: Record<TextUploadMode, string> = {
  exercises: `Dumbbell Flat Bench Press
Seated Cable Row | Back
Romanian Deadlift | Legs, Posterior chain
# One exercise per line. Optional tags after | or comma`,
  workout: `So Upper Body Workout

Warm up 5 min bike

Flat bench dumbbell press
10,10,10,10

Incline dumbbell press
10,10,10,10 each arm

HIIT cool down 5 mins`,
  "program-week": `Day 1 Gym: Day 1 Upper Body Workout (Gym)
Day 1 Home: Day 1 Upper Body Workout (Home)
Day 2 Gym: Day 2 Lower Body Workout (Gym)
Day 2 Home: Day 2 Lower Body Workout (Home)
Day 3 Gym: Day 3 Workout (Gym)`,
};

const HINTS: Record<TextUploadMode, string> = {
  exercises:
    "One exercise per line. Add tags after | or comma (e.g. Back Row | Back, Chest). Matches existing names are skipped.",
  workout:
    "Same format as Go to Today / SMS paste — title, warm-up, exercise names, sets/reps lines. Saves a new workout to your library.",
  "program-week":
    "Assign workouts to days in the selected week. Format: Day N Gym: Workout Name (must match a workout in your library).",
};

type PreviewData =
  | { mode: "exercises"; exercises: Array<{ name: string; tags?: string }> }
  | {
      mode: "workout";
      workout: { title: string; exercises: Array<{ name: string; sets: number; reps: string; notes?: string }> };
    }
  | {
      mode: "program-week";
      slots: Array<{ dayNumber: number; label: string; workoutName: string }>;
      warnings?: string[];
    };

export default function TextUploadPanel({
  mode,
  programSlug,
  weekNumber,
  weekOptions,
  onBuilt,
  collapsible = true,
  defaultOpen = false,
}: {
  mode: TextUploadMode;
  programSlug?: string;
  weekNumber?: number;
  weekOptions?: number[];
  onBuilt?: (result: Record<string, unknown>) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [workoutName, setWorkoutName] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(weekNumber ?? 1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [newExerciseCount, setNewExerciseCount] = useState(0);
  const [open, setOpen] = useState(defaultOpen);

  function formatResponseError(res: Response, body: Record<string, unknown>) {
    if (typeof body.error === "string") return body.error;
    if (body.detail) return formatApiError(body.detail);
    return res.statusText || "Unknown error";
  }

  async function handleParse() {
    if (!rawText.trim()) return;
    setMessage(null);
    setMessageIsError(false);
    try {
      const res = await fetch("/api/text-upload/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, rawText: rawText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessageIsError(true);
        setMessage(`Parse failed: ${formatResponseError(res, data)}`);
        return;
      }
      setPreview(data as PreviewData);
      if (mode === "exercises") {
        setMessage(`Found ${data.exercises?.length || 0} exercises — review below, then Build.`);
      } else if (mode === "workout") {
        setMessage(`Parsed "${data.workout?.title}" — ${data.workout?.exercises?.length || 0} blocks. Review, then Build.`);
      } else {
        setMessage(`Parsed ${data.slots?.length || 0} day slots${data.warnings?.length ? ` (${data.warnings.length} lines skipped)` : ""}.`);
      }
      setMessageIsError(false);
    } catch (e: any) {
      setMessageIsError(true);
      setMessage(`Parse failed: ${e?.message || "network error"}`);
    }
  }

  async function handleBuild() {
    if (!rawText.trim()) return;
    if (mode === "program-week" && !programSlug) {
      setMessageIsError(true);
      setMessage("Program slug missing — reload the page.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setMessageIsError(false);

    try {
      const body: Record<string, unknown> = {
        mode,
        rawText: rawText.trim(),
      };
      if (mode === "workout" && workoutName.trim()) {
        body.workoutName = workoutName.trim();
      }
      if (mode === "program-week") {
        body.programSlug = programSlug;
        body.weekNumber = selectedWeek;
      }

      const res = await fetch("/api/text-upload/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessageIsError(true);
        setMessage(`Build failed: ${formatResponseError(res, data)}`);
        return;
      }

      const created =
        Array.isArray(data.newExerciseIds) ? data.newExerciseIds.length : data.created ?? 0;
      setNewExerciseCount(created);

      if (mode === "exercises") {
        setMessage(
          `Added ${data.created} exercise${data.created !== 1 ? "s" : ""}${data.skipped ? ` · skipped ${data.skipped} duplicates` : ""}.`,
        );
      } else if (mode === "workout") {
        setMessage(
          `Saved workout "${data.workoutName}" with ${data.exerciseCount} blocks.`,
        );
      } else {
        setMessage(
          `Applied ${data.appliedCount} slot${data.appliedCount !== 1 ? "s" : ""} to week ${data.weekNumber}.${data.unresolved?.length ? ` ${data.unresolved.length} unmatched.` : ""}`,
        );
      }

      setMessageIsError(false);
      onBuilt?.(data);
      router.refresh();

      if (mode === "workout" && data.workoutId) {
        setTimeout(() => {
          window.location.href = `/admin/workouts/${data.workoutId}`;
        }, 800);
      }
    } catch (e: any) {
      setMessageIsError(true);
      setMessage(`Build failed: ${e?.message || "network error"}`);
    } finally {
      setSaving(false);
    }
  }

  const panelBody = (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted)]">{HINTS[mode]}</p>

      {mode === "workout" && (
        <label className="block text-xs">
          <span className="text-[var(--muted)]">Workout name (optional — uses parsed title if blank)</span>
          <input
            className="input mt-1 w-full"
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            placeholder="e.g. Day 3 Upper Body - Home"
          />
        </label>
      )}

      {mode === "program-week" && weekOptions && weekOptions.length > 0 && (
        <label className="block text-xs">
          <span className="text-[var(--muted)]">Target week</span>
          <select
            className="input mt-1 w-full"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
          >
            {weekOptions.map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </label>
      )}

      <textarea
        className="input h-36 w-full resize-y font-mono text-sm"
        placeholder={PLACEHOLDERS[mode]}
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleParse} disabled={!rawText.trim()} className="btn-ghost text-sm px-3 py-1">
          Preview parse
        </button>
        <button
          type="button"
          onClick={handleBuild}
          disabled={saving || !rawText.trim()}
          className="btn-primary text-sm px-4 py-1"
        >
          {saving ? "Building..." : "Build & save"}
        </button>
      </div>

      {message && (
        <div className="space-y-1">
          <p className={`text-xs ${messageIsError ? "text-red-400" : "text-[var(--success)]"}`}>{message}</p>
          {!messageIsError && newExerciseCount > 0 && (
            <Link href="/admin/exercises?tab=newly-added" className="inline-block text-xs font-medium text-accent hover:underline">
              Review {newExerciseCount} newly added exercise{newExerciseCount !== 1 ? "s" : ""} →
            </Link>
          )}
        </div>
      )}

      {preview?.mode === "exercises" && (
        <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-3 text-xs max-h-48 overflow-auto">
          <p className="font-semibold text-accent mb-2">{preview.exercises.length} exercises</p>
          <ul className="space-y-1">
            {preview.exercises.map((ex, i) => (
              <li key={i}>
                <span className="font-medium">{ex.name}</span>
                {ex.tags && <span className="text-[var(--muted)]"> · {ex.tags}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview?.mode === "workout" && (
        <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-3 text-xs max-h-48 overflow-auto">
          <p className="font-semibold text-accent mb-2">
            {preview.workout.title} — {preview.workout.exercises.length} blocks
          </p>
          <ul className="space-y-1">
            {preview.workout.exercises.map((ex, i) => (
              <li key={i}>
                <span className="font-medium">{ex.name}</span>
                <span className="text-[var(--muted)]"> · {ex.sets}×{ex.reps}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview?.mode === "program-week" && (
        <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-3 text-xs max-h-48 overflow-auto">
          <p className="font-semibold text-accent mb-2">{preview.slots.length} day slots</p>
          <ul className="space-y-1">
            {preview.slots.map((s, i) => (
              <li key={i}>
                Day {s.dayNumber} <span className="text-accent">{s.label}</span>: {s.workoutName}
              </li>
            ))}
          </ul>
          {preview.warnings && preview.warnings.length > 0 && (
            <p className="mt-2 text-[10px] text-amber-400">{preview.warnings.slice(0, 3).join(" · ")}</p>
          )}
        </div>
      )}
    </div>
  );

  if (collapsible) {
    return (
      <div className="card border-amber-500/30 bg-amber-500/5">
        <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-sm font-semibold">
            <span className="text-accent transition-transform text-xs">▶</span>
            Text Upload
          </summary>
          <div className="mt-3 border-t border-amber-500/20 pt-3">{panelBody}</div>
        </details>
      </div>
    );
  }

  return (
    <div className="card border-amber-500/30 bg-amber-500/5 space-y-3">
      <h2 className="text-sm font-semibold">Text Upload</h2>
      {panelBody}
    </div>
  );
}