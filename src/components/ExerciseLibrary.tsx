"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatApiError } from "@/lib/api-errors";
import { isYoutubeUrl } from "@/lib/youtube";

type Exercise = {
  id: string;
  name: string;
  description: string | null;
  videoUrl: string | null;
  tags: string | null;
};

type UsageSummary = {
  programCount: number;
  workoutCount: number;
  programs: Array<{ name: string; slug: string }>;
};

type ExerciseUsage = {
  exerciseId: string;
  programCount: number;
  workoutCount: number;
  programs: Array<{
    id: string;
    name: string;
    slug: string;
    workoutCount: number;
    references: Array<{
      workoutId: string;
      workoutName: string;
      label: string;
      week: number;
      day: number;
    }>;
  }>;
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

function ExerciseNameCell({
  exercise,
  onSaved,
}: {
  exercise: Exercise;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(exercise.name);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cellError, setCellError] = useState<string | null>(null);

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setCellError("Name is required.");
      return;
    }
    setCellError(null);
    setSaving(true);
    const res = await fetch(`/api/exercises/${exercise.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
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

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium">{exercise.name}</span>
        <button
          type="button"
          className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
          onClick={() => {
            setDraft(exercise.name);
            setEditing(true);
          }}
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-[200px] space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input min-w-0 flex-1 py-1 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={`Name for ${exercise.name}`}
        />
        <button
          type="button"
          className="btn-primary shrink-0 px-3 py-1 text-xs"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          className="text-accent hover:underline"
          onClick={() => {
            setDraft(exercise.name);
            setCellError(null);
          }}
        >
          Revert to original
        </button>
        <span className="text-[var(--muted)]">Original: {exercise.name}</span>
        <button
          type="button"
          className="text-[var(--muted)] hover:text-[var(--text)]"
          onClick={() => {
            setDraft(exercise.name);
            setEditing(false);
            setCellError(null);
          }}
        >
          Cancel
        </button>
      </div>
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
  const [usages, setUsages] = useState<Record<string, UsageSummary>>({});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [tags, setTags] = useState(""); // for new exercise form
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [detailedUsage, setDetailedUsage] = useState<ExerciseUsage | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Collapsible instructions (collapsed by default to save real estate)
  const [showInstructions, setShowInstructions] = useState(false);

  // Collapsible "Add New" form (collapsed by default)
  const [showAddForm, setShowAddForm] = useState(false);

  // Search and categories (P1 from transcript: "search... type in back and boom" + categories "like we did before")
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const COMMON_CATEGORIES = ["Back", "Chest", "Legs", "Shoulders", "Arms", "Core", "Full Body", "Mobility", "Cardio"];

  const load = useCallback(async () => {
    setLoading(true);
    const [exRes, usageRes] = await Promise.all([
      fetch("/api/exercises"),
      fetch("/api/exercises/usage"),
    ]);

    if (!exRes.ok) {
      setLoading(false);
      return;
    }
    const exs = await exRes.json();
    setExercises(exs);

    if (usageRes.ok) {
      setUsages(await usageRes.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Compute filtered list for search + category chips (client-side, instant)
  const filteredExercises = exercises
    .filter((ex) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        ex.name.toLowerCase().includes(q) ||
        (ex.description || "").toLowerCase().includes(q) ||
        (ex.tags || "").toLowerCase().includes(q)
      );
    })
    .filter((ex) => {
      if (selectedCategories.length === 0) return true;
      // Smart category matching: use explicit tags if present, otherwise fall back
      // to the same name-based guessing logic as the seeder. This ensures
      // "Bench Press" (which is semantically Chest) shows up when you click the
      // "Chest" chip, even if tags haven't been seeded yet.
      const effective = ex.tags || guessTags(ex.name);
      const exTags = effective.toLowerCase().split(/[\s,]+/);
      return selectedCategories.some((cat) =>
        exTags.some((t) => t.includes(cat.toLowerCase()))
      );
    });

  async function openUsage(ex: Exercise) {
    setSelectedExercise(ex);
    setDetailedUsage(null);
    setModalLoading(true);
    try {
      const res = await fetch(`/api/exercises/${ex.id}/usage`);
      if (res.ok) {
        setDetailedUsage(await res.json());
      }
    } finally {
      setModalLoading(false);
    }
  }

  function closeUsage() {
    setSelectedExercise(null);
    setDetailedUsage(null);
  }

  function toggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  // One-time seeder for default categories based on name (P1 from transcript)
  async function seedDefaultTags() {
    const untagged = exercises.filter((ex) => !ex.tags);
    if (untagged.length === 0) {
      setMessage("All exercises already have tags.");
      return;
    }
    setMessage(`Seeding tags for ${untagged.length} exercises...`);
    for (const ex of untagged) {
      const guessed = guessTags(ex.name);
      try {
        await fetch(`/api/exercises/${ex.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: guessed }),
        });
      } catch {}
    }
    setMessage(`Seeded default tags for ${untagged.length} exercises.`);
    await load();
  }

  function guessTags(name: string): string {
    const n = name.toLowerCase();
    const tags: string[] = [];
    if (/squat|deadlift|lunge|leg|glute|ham|calf/.test(n)) tags.push("Legs");
    if (/bench|chest|push.?up|fly/.test(n)) tags.push("Chest");
    if (/row|pull|chin|lat|back/.test(n)) tags.push("Back");
    if (/shoulder|overhead|shrug|lateral|deltoid|press/.test(n)) tags.push("Shoulders");
    if (/curl|extension|tricep|bicep/.test(n)) tags.push("Arms");
    if (/plank|crunch|sit.?up|core|ab|mountain/.test(n)) tags.push("Core");
    if (/burpee|jump|run|cardio|sprint/.test(n)) tags.push("Cardio");
    if (/warm|mobility|stretch|foam|dynamic/.test(n)) tags.push("Mobility");
    if (tags.length === 0) tags.push("Full Body");
    return tags.join(", ");
  }

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
        tags: tags.trim() || undefined,
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
    setTags("");
    setMessage(`Added “${created.name}” to the library.`);
    await load();
  }

  async function remove(id: string, exerciseName: string) {
    const u = usages[id];
    const usageNote = u && u.programCount > 0
      ? ` (used in ${u.programCount} program${u.programCount === 1 ? "" : "s"} / ${u.workoutCount} workout${u.workoutCount === 1 ? "" : "s"} — it will be removed from those workouts)`
      : "";
    if (!confirm(`Delete “${exerciseName}” from the library?${usageNote}`)) return;
    await fetch(`/api/exercises/${id}`, { method: "DELETE" });
    setMessage(null);
    await load();
  }

  return (
    <div className="space-y-6">
      {/* Collapsible "Add New to Exercise Library" form - starts collapsed like the directions above.
          Large triangle indicator. */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 text-xl font-semibold tracking-tight hover:text-accent"
        >
          <span className={`text-3xl leading-none transition-transform ${showAddForm ? 'rotate-90' : ''}`}>▶</span>
          Add New to Exercise Library
        </button>
        {showAddForm && (
          <form onSubmit={handleAdd} className="card space-y-4 mt-3">
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

            <div>
              <FieldLabel
                htmlFor="ex-tags"
                label="Categories / Tags"
                hint="Comma-separated e.g. Legs, Back, Strength. Used for filtering and review."
              />
              <input
                id="ex-tags"
                className="input mt-2"
                placeholder="Legs, Back, Core"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
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
        )}
      </div>

      {/* Collapsible "Exercise Library Directions" - starts collapsed to save real estate.
          Large triangle (▶) indicating you can expand.
          The directions/instructions fold out below when expanded.
          Placed just above the search layer. */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowInstructions(!showInstructions)}
          className="flex items-center gap-2 text-xl font-semibold tracking-tight hover:text-accent"
        >
          <span className={`text-3xl leading-none transition-transform ${showInstructions ? 'rotate-90' : ''}`}>▶</span>
          Exercise Library Directions
        </button>
        {showInstructions && (
          <div className="mt-3 pl-9 text-sm text-[var(--muted)] space-y-3">
            <p>
              Each movement has a name, optional description, and optional demo
              video. Reuse the same exercise in any workout.
            </p>

            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[10px] font-bold">1</span>
                <div>
                  <p className="font-medium text-[var(--text)]">Name the movement</p>
                  <p className="text-xs">e.g. <em>Back Squat</em> — required.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[10px] font-bold">2</span>
                <div>
                  <p className="font-medium text-[var(--text)]">Description (optional)</p>
                  <p className="text-xs">A short summary members can read in the library context.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[10px] font-bold">3</span>
                <div>
                  <p className="font-medium text-[var(--text)]">Add a demo video (optional)</p>
                  <p className="text-xs">YouTube or other link — members can watch without leaving the workout.</p>
                </div>
              </li>
            </ol>

            <p className="text-xs">
              <strong className="text-[var(--text)]">Programming lives in workouts:</strong>{" "}
              set approach, sets or timed duration, weight tier, and coaching notes
              are set under{" "}
              <strong className="text-[var(--text)]">Admin → Workouts</strong> when you
              add each exercise.
            </p>

            <p className="text-xs">
              The library table now shows where each exercise is scheduled (programs + specific days).
              Click “View details” on any row for the full breakdown and direct links.
            </p>
          </div>
        )}
      </div>

      {/* Search + Category filters (P1 from transcript) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search name, description, or tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1"
        />
        <div className="flex flex-wrap gap-1">
          {COMMON_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={`text-xs px-2 py-1 rounded border transition ${
                selectedCategories.includes(cat)
                  ? "bg-accent text-white border-accent"
                  : "bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {cat}
            </button>
          ))}
          {selectedCategories.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategories([])}
              className="text-xs px-2 py-1 text-[var(--muted)] hover:text-[var(--text)]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="table-wrap card">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Your library ({loading ? "…" : filteredExercises.length}{" "}
            {search || selectedCategories.length > 0 ? `of ${exercises.length}` : ""})
          </h3>
          <button
            type="button"
            onClick={seedDefaultTags}
            className="text-xs text-accent hover:underline"
            title="One-time: guess and apply tags like Legs, Back, Core based on exercise names (per transcript request)"
          >
            Seed default tags for untagged
          </button>
        </div>

        {filteredExercises.length === 0 && exercises.length > 0 && !loading && (
          <p className="p-4 text-sm text-[var(--muted)]">
            No exercises match the current search or selected categories.
            Try clearing the filters above or click “Seed default tags for untagged” to populate categories from exercise names.
          </p>
        )}

        {loading ? (
          <p className="mt-4 text-[var(--muted)]">Loading…</p>
        ) : exercises.length === 0 ? (
          <p className="mt-4 text-[var(--muted)]">
            No exercises yet — add one above.
          </p>
        ) : filteredExercises.length > 0 && (
          <table className="data mt-4">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Video</th>
                <th>Tags</th>
                <th>Programs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredExercises.map((ex) => {
                const u = usages[ex.id];
                const tagList = (ex.tags || "").split(/[\s,]+/).filter(Boolean);
                return (
                  <tr key={ex.id}>
                    <td className="align-top">
                      <ExerciseNameCell exercise={ex} onSaved={load} />
                    </td>
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
                      <div className="flex flex-wrap gap-1 text-[10px] items-center">
                        {tagList.length > 0 ? (
                          tagList.map((t, i) => (
                            <span key={i} className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[var(--muted)]">
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            const current = ex.tags || "";
                            const newTags = prompt("Edit tags (comma separated):", current);
                            if (newTags === null) return;
                            await fetch(`/api/exercises/${ex.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ tags: newTags.trim() || null }),
                            });
                            await load();
                          }}
                          className="text-[var(--muted)] hover:text-[var(--text)] text-[9px] underline"
                        >
                          edit
                        </button>
                      </div>
                    </td>
                    <td className="align-top text-xs">
                      {u && u.programs.length > 0 ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {u.programs.map((p) => (
                              <a
                                key={p.slug}
                                href={`/admin/programs/${p.slug}`}
                                className="rounded bg-accent-muted px-1.5 py-0.5 text-[10px] text-accent hover:underline"
                                title={`View ${p.name} program`}
                              >
                                {p.name}
                              </a>
                            ))}
                          </div>
                          <div className="text-[var(--muted)] text-[10px]">
                            {u.programCount} program{u.programCount === 1 ? "" : "s"} • {u.workoutCount} workout{u.workoutCount === 1 ? "" : "s"}
                          </div>
                          <button
                            type="button"
                            onClick={() => openUsage(ex)}
                            className="text-accent hover:underline text-[10px]"
                          >
                            View full usage →
                          </button>
                        </div>
                      ) : (
                        <span className="text-[var(--muted)] text-[10px]">Not in any programs</span>
                      )}
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Usage details modal */}
      {selectedExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeUsage}>
          <div
            className="card w-full max-w-2xl max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold">Where “{selectedExercise.name}” is used</h3>
                <p className="text-sm text-[var(--muted)] mt-0.5">
                  This helps when reviewing or cleaning up the library.
                </p>
              </div>
              <button
                type="button"
                onClick={closeUsage}
                className="text-[var(--muted)] hover:text-[var(--text)] text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {modalLoading ? (
              <p className="mt-6 text-[var(--muted)]">Loading usage…</p>
            ) : detailedUsage && detailedUsage.programs.length > 0 ? (
              <div className="mt-6 space-y-6">
                {detailedUsage.programs.map((prog) => (
                  <div key={prog.id} className="border border-[var(--border)] rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <a
                        href={`/admin/programs/${prog.slug}`}
                        className="font-semibold text-lg hover:underline text-accent"
                      >
                        {prog.name}
                      </a>
                      <span className="text-xs bg-accent-muted text-accent px-2 py-0.5 rounded">
                        {prog.workoutCount} workout{prog.workoutCount === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 text-sm">
                      {prog.references.map((ref, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[var(--muted)]">
                          <a
                            href={`/admin/workouts/${ref.workoutId}`}
                            className="text-accent hover:underline font-medium"
                          >
                            {ref.workoutName}
                          </a>
                          <span>·</span>
                          <span>
                            W{ref.week} D{ref.day} ({ref.label})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-[var(--muted)]">
                This exercise is not currently scheduled in any program (it may still be in standalone workouts).
              </p>
            )}

            <div className="mt-6 pt-4 border-t border-[var(--border)] text-xs text-[var(--muted)]">
              Tip: Click a program or workout name to jump directly to it in the admin.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}