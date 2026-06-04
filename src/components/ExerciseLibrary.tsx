"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatApiError } from "@/lib/api-errors";
import { isYoutubeUrl } from "@/lib/youtube";

type Exercise = {
  id: string;
  name: string;
  description: string | null;
  videoUrl: string | null;
};

function FieldLabel({
  htmlFor,
  label,
  required,
  hint,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  hint: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span>
    </label>
  );
}

function ExerciseVideoCell({
  exercise,
  onSaved,
}: {
  exercise: Exercise;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(exercise.videoUrl ?? "");
  const [editing, setEditing] = useState(!exercise.videoUrl);
  const [saving, setSaving] = useState(false);
  const [cellError, setCellError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(exercise.videoUrl ?? "");
    if (!exercise.videoUrl) setEditing(true);
  }, [exercise.videoUrl]);

  async function save() {
    const trimmed = draft.trim();
    setCellError(null);
    setSaving(true);
    const res = await fetch(`/api/exercises/${exercise.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl: trimmed || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setCellError(formatApiError((body as { detail?: unknown }).detail));
      return;
    }
    setEditing(false);
    await onSaved();
  }

  if (exercise.videoUrl && !editing) {
    const label = isYoutubeUrl(exercise.videoUrl)
      ? exercise.videoUrl.replace(/^https?:\/\/(www\.)?/, "")
      : "Video link";
    return (
      <div className="space-y-1">
        <a
          href={exercise.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm text-accent hover:underline"
          title={exercise.videoUrl}
        >
          {label}
        </a>
        <button
          type="button"
          className="block text-xs text-[var(--muted)] hover:text-[var(--text)]"
          onClick={() => {
            setDraft(exercise.videoUrl ?? "");
            setEditing(true);
          }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-[200px] space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input min-w-0 flex-1 py-1.5 text-sm"
          type="url"
          placeholder="https://youtube.com/watch?v=…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={`Video link for ${exercise.name}`}
        />
        <button
          type="button"
          className="btn-primary shrink-0 px-3 py-1.5 text-xs"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : exercise.videoUrl ? "Update" : "Add"}
        </button>
      </div>
      {exercise.videoUrl && (
        <button
          type="button"
          className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
          onClick={() => {
            setDraft(exercise.videoUrl ?? "");
            setEditing(false);
            setCellError(null);
          }}
        >
          Cancel
        </button>
      )}
      {cellError && (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {cellError}
        </p>
      )}
    </div>
  );
}

export default function ExerciseLibrary() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/exercises");
    if (!res.ok) {
      setLoading(false);
      return;
    }
    setExercises(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!name.trim()) {
      setError("Exercise name is required.");
      return;
    }

    const res = await fetch("/api/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(formatApiError((body as { detail?: unknown }).detail));
      return;
    }

    const created = (await res.json()) as Exercise;
    setName("");
    setDescription("");
    setVideoUrl("");
    setMessage(`Added “${created.name}” to the library.`);
    await load();
  }

  async function remove(id: string, exerciseName: string) {
    if (!confirm(`Delete “${exerciseName}” from the library?`)) return;
    await fetch(`/api/exercises/${id}`, { method: "DELETE" });
    setMessage(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="card space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          New exercise
        </p>
        <p className="text-sm text-[var(--muted)]">
          Name, description, and demo video. Sets, weight, and workout-specific
          notes are configured under Workouts.
        </p>

        <div>
          <FieldLabel
            htmlFor="ex-name"
            label="Exercise name"
            required
            hint="What members see in the workout list."
          />
          <input
            id="ex-name"
            className="input mt-2"
            placeholder="e.g. Back Squat"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <FieldLabel
            htmlFor="ex-desc"
            label="Description"
            hint="Short overview of the movement. Optional."
          />
          <textarea
            id="ex-desc"
            className="input mt-2 min-h-[80px] resize-y"
            placeholder="e.g. Barbell squat targeting quads and glutes…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <FieldLabel
            htmlFor="ex-video"
            label="Demo video link"
            hint="Paste any YouTube URL (watch or youtu.be). Optional."
          />
          <input
            id="ex-video"
            className="input mt-2"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-[var(--success)]" role="status">
            {message}
          </p>
        )}

        <button type="submit" className="btn-primary">
          Add to library
        </button>
      </form>

      <div className="table-wrap card">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Your library ({loading ? "…" : exercises.length})
        </h3>
        {loading ? (
          <p className="mt-4 text-[var(--muted)]">Loading…</p>
        ) : exercises.length === 0 ? (
          <p className="mt-4 text-[var(--muted)]">
            No exercises yet — add one above.
          </p>
        ) : (
          <table className="data mt-4">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Video</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((ex) => (
                <tr key={ex.id}>
                  <td className="align-top font-medium">{ex.name}</td>
                  <td className="max-w-xs align-top text-sm text-[var(--muted)]">
                    {ex.description ? (
                      <span className="line-clamp-3">{ex.description}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="align-top">
                    <ExerciseVideoCell exercise={ex} onSaved={load} />
                  </td>
                  <td className="align-top">
                    <button
                      type="button"
                      className="text-sm text-[var(--danger)]"
                      onClick={() => remove(ex.id, ex.name)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}