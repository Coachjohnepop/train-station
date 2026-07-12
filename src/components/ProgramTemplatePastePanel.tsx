"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatApiErrorDetail } from "@/lib/api-errors";
import { TEMPLATE_CATEGORY_SUGGESTIONS } from "@/lib/workout-template-constants";

type TemplateRow = {
  id: string;
  name: string;
  category: string;
  versionLabel: string | null;
  notes: string | null;
  workoutId: string;
  exerciseCount?: number;
  workoutName?: string;
};

type WorkoutRow = { id: string; name: string; _count?: { exercises: number } };

type Props = {
  programSlug: string;
  /** Focused program day id */
  dayId: string | null;
  /** Focused workout to promote (optional) */
  focusWorkoutId: string | null;
  focusWorkoutLabel?: string;
  disabled?: boolean;
  onPasted: () => void | Promise<void>;
  onMessage?: (msg: string) => void;
};

export default function ProgramTemplatePastePanel({
  programSlug,
  dayId,
  focusWorkoutId,
  focusWorkoutLabel,
  disabled,
  onPasted,
  onMessage,
}: Props) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [category, setCategory] = useState<string>("");
  const [sourceMode, setSourceMode] = useState<"template" | "workout">("template");
  const [templateId, setTemplateId] = useState("");
  const [workoutId, setWorkoutId] = useState("");
  const [trackGym, setTrackGym] = useState(true);
  const [trackHome, setTrackHome] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Promote form
  const [promoName, setPromoName] = useState("");
  const [promoCategory, setPromoCategory] = useState("general");
  const [promoVersion, setPromoVersion] = useState("");
  const [promoNotes, setPromoNotes] = useState("");

  // 28-day cycle
  const [cycleName, setCycleName] = useState("");
  const [libraryCycles, setLibraryCycles] = useState<
    { id: string; name: string; programId?: string | null }[]
  >([]);
  const [pasteCycleId, setPasteCycleId] = useState("");
  const [pasteCycleMonth, setPasteCycleMonth] = useState(1);
  const [showArchivedTemplates, setShowArchivedTemplates] = useState(false);
  const [archivedTemplates, setArchivedTemplates] = useState<TemplateRow[]>([]);

  const load = useCallback(async () => {
    const [tRes, wRes, cRes, archRes] = await Promise.all([
      fetch("/api/workout-templates?archive=active", { cache: "no-store" }),
      fetch("/api/workouts", { cache: "no-store" }),
      fetch("/api/workout-cycles?library=1&archive=active", { cache: "no-store" }),
      fetch("/api/workout-templates?archive=archived", { cache: "no-store" }),
    ]);
    if (tRes.ok) setTemplates(await tRes.json());
    if (wRes.ok) setWorkouts(await wRes.json());
    if (cRes.ok) {
      const cycles = await cRes.json();
      setLibraryCycles(
        (Array.isArray(cycles) ? cycles : []).filter(
          (c: { programId?: string | null }) => !c.programId,
        ),
      );
    }
    if (archRes.ok) setArchivedTemplates(await archRes.json());
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (focusWorkoutLabel) {
      setPromoName((prev) => prev || focusWorkoutLabel);
    }
  }, [focusWorkoutLabel]);

  const filteredTemplates = useMemo(() => {
    if (!category) return templates;
    return templates.filter((t) => t.category === category);
  }, [templates, category]);

  /** Freeform: suggestions + any category already used (yoga, dog-training, …). */
  const categories = useMemo(() => {
    const set = new Set<string>([...TEMPLATE_CATEGORY_SUGGESTIONS]);
    for (const t of templates) {
      if (t.category?.trim()) set.add(t.category.trim().toLowerCase());
    }
    return [...set].sort();
  }, [templates]);

  function msg(text: string) {
    onMessage?.(text);
  }

  async function pasteWorkout() {
    if (!dayId) {
      setError("Select a day first (Gym or Home).");
      return;
    }
    if (!trackGym && !trackHome) {
      setError("Select Gym and/or Home track.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body =
        sourceMode === "template"
          ? {
              templateId,
              dayId,
              tracks: { gym: trackGym, home: trackHome },
              replace: true,
            }
          : {
              sourceWorkoutId: workoutId,
              dayId,
              tracks: { gym: trackGym, home: trackHome },
              replace: true,
            };
      if (sourceMode === "template" && !templateId) {
        setError("Pick a template.");
        return;
      }
      if (sourceMode === "workout" && !workoutId) {
        setError("Pick a workout.");
        return;
      }
      const res = await fetch("/api/workout-templates/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatApiErrorDetail(data.detail) || "Paste failed");
        return;
      }
      msg(
        `Pasted as new ${[trackGym && "Gym", trackHome && "Home"].filter(Boolean).join(" + ")} copy — source unchanged.`,
      );
      await onPasted();
    } finally {
      setBusy(false);
    }
  }

  async function promoteFocus() {
    if (!focusWorkoutId) {
      setError("Open a workout on this day first, then save as template.");
      return;
    }
    const name = promoName.trim();
    if (!name) {
      setError("Template name required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/workout-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceWorkoutId: focusWorkoutId,
          name,
          category: promoCategory,
          versionLabel: promoVersion.trim() || null,
          notes: promoNotes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatApiErrorDetail(data.detail) || "Could not save template");
        return;
      }
      msg(`Saved template “${name}” — paste anytime (always a fresh copy).`);
      setSourceMode("template");
      setTemplateId(data.id);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function snapshotMonth() {
    const name = cycleName.trim();
    if (!name) {
      setError("Name the 28-day pack (e.g. Adult M1 v_adult).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/workout-cycles/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug,
          cycleMonth: 1,
          name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatApiErrorDetail(data.detail) || "Snapshot failed");
        return;
      }
      msg(`Saved 28-day pack “${name}” to library (deep clone).`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function archiveSelectedTemplate() {
    if (!templateId) {
      setError("Pick a template to archive.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workout-templates/${templateId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatApiErrorDetail(data.detail) || "Archive failed");
        return;
      }
      setTemplateId("");
      msg("Template archived — find it under Archive shelf.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function restoreTemplate(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workout-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatApiErrorDetail(data.detail) || "Restore failed");
        return;
      }
      msg("Template restored to the active library.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function hardDeleteTemplate(id: string, name: string) {
    const ok = window.confirm(
      `Permanently delete archived template “${name}”?\n\nThis cannot be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workout-templates/${id}?hard=1`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatApiErrorDetail(data.detail) || "Delete failed");
        return;
      }
      msg("Template permanently deleted.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function pasteMonth() {
    if (!pasteCycleId) {
      setError("Pick a library 28-day pack.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        sourceCycleId: pasteCycleId,
        programSlug,
        cycleMonth: pasteCycleMonth,
        force: false as boolean,
      };
      let res = await fetch("/api/workout-cycles/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let data = await res.json().catch(() => ({}));
      if (res.status === 409 || data.code === "CONTENT_EXISTS" || data.detail === "CONTENT_EXISTS") {
        const summary = data.summary || "existing workouts on this month";
        const ok = window.confirm(
          `M${pasteCycleMonth} already has content (${summary}).\n\nReplace it with a fresh clone from the library? This cannot be undone.`,
        );
        if (!ok) {
          setError("Paste cancelled — existing month left unchanged.");
          return;
        }
        body.force = true;
        res = await fetch("/api/workout-cycles/paste", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        data = await res.json().catch(() => ({}));
      }
      if (!res.ok) {
        setError(formatApiErrorDetail(data.detail) || "Paste month failed");
        return;
      }
      msg(`Pasted 28-day pack onto M${pasteCycleMonth} (day numbers, all tracks cloned).`);
      await onPasted();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn-ghost px-2 py-1 text-xs font-semibold text-violet-200"
        disabled={disabled}
        onClick={() => setOpen(true)}
        title="Paste templates, save templates, 28-day packs"
      >
        Templates & paste
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-violet-500/30 bg-[var(--surface)] p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-violet-100">Templates & paste</p>
        <button type="button" className="btn-ghost px-2 py-0.5 text-[10px]" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <p className="text-[10px] text-[var(--muted)]">
        Paste always clones — source stays safe. Open the copy in the editor to tweak. Deselect Gym or
        Home to paste one track only. Categories are freeform (yoga, meditation, eating, martial arts,
        dog training, …) — type any label when saving a template.
      </p>

      {error && (
        <p className="rounded border border-[var(--danger)]/40 bg-[var(--surface-2)] px-2 py-1 text-[var(--danger)]">
          {error}
        </p>
      )}

      {/* Paste workout */}
      <div className="space-y-2 rounded-md border border-[var(--border)] p-2">
        <p className="text-[11px] font-semibold">Paste workout → this day</p>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={sourceMode === "template"}
              onChange={() => setSourceMode("template")}
            />
            Template library
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={sourceMode === "workout"}
              onChange={() => setSourceMode("workout")}
            />
            Any workout
          </label>
        </div>

        {sourceMode === "template" ? (
          <div className="flex flex-wrap gap-2">
            <select
              className="input h-8 min-w-[7rem] text-xs"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="input h-8 min-w-[12rem] flex-1 text-xs"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Pick template…</option>
              {filteredTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.category}] {t.name}
                  {t.versionLabel ? ` · ${t.versionLabel}` : ""} (
                  {t.exerciseCount ?? "?"} ex)
                </option>
              ))}
            </select>
          </div>
        ) : (
          <select
            className="input h-8 w-full text-xs"
            value={workoutId}
            onChange={(e) => setWorkoutId(e.target.value)}
          >
            <option value="">Pick workout…</option>
            {workouts.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w._count?.exercises ?? "?"} ex)
              </option>
            ))}
          </select>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={trackGym}
              onChange={(e) => setTrackGym(e.target.checked)}
            />
            Gym track
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={trackHome}
              onChange={(e) => setTrackHome(e.target.checked)}
            />
            Home track
          </label>
          <button
            type="button"
            className="btn-primary h-8 px-3 text-[11px]"
            disabled={busy || disabled || !dayId}
            onClick={() => void pasteWorkout()}
          >
            Paste as copy
          </button>
        </div>
        {!dayId && (
          <p className="text-[10px] text-amber-300/90">Select a day (Gym/Home) in the calendar first.</p>
        )}
      </div>

      {/* Promote */}
      <div className="space-y-2 rounded-md border border-[var(--border)] p-2">
        <p className="text-[11px] font-semibold">Save current workout as template</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            Name
            <input
              className="input mt-0.5 h-8 w-full text-xs"
              value={promoName}
              onChange={(e) => setPromoName(e.target.value)}
              placeholder="Upper body"
            />
          </label>
          <label className="block">
            Category (type any — yoga, dog-training, …)
            <input
              className="input mt-0.5 h-8 w-full text-xs"
              list="template-category-suggestions"
              value={promoCategory}
              onChange={(e) => setPromoCategory(e.target.value)}
              placeholder="e.g. yoga, martial-arts, nutrition"
            />
            <datalist id="template-category-suggestions">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block">
            Version tag (optional)
            <input
              className="input mt-0.5 h-8 w-full text-xs"
              value={promoVersion}
              onChange={(e) => setPromoVersion(e.target.value)}
              placeholder="v_adult, vyoungkids…"
            />
          </label>
          <label className="block">
            Notes (optional)
            <input
              className="input mt-0.5 h-8 w-full text-xs"
              value={promoNotes}
              onChange={(e) => setPromoNotes(e.target.value)}
              placeholder="Your notes"
            />
          </label>
        </div>
        <button
          type="button"
          className="btn-ghost h-8 px-3 text-[11px]"
          disabled={busy || disabled || !focusWorkoutId}
          onClick={() => void promoteFocus()}
        >
          Promote to template library
        </button>
      </div>

      {/* Archive shelf — look back before permanent delete */}
      <div className="space-y-2 rounded-md border border-dashed border-[var(--border)] p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold">Archive shelf</p>
          <button
            type="button"
            className="btn-ghost px-2 py-0.5 text-[10px]"
            onClick={() => setShowArchivedTemplates((v) => !v)}
          >
            {showArchivedTemplates ? "Hide" : "Show"} archived templates (
            {archivedTemplates.length})
          </button>
        </div>
        <p className="text-[10px] text-[var(--muted)]">
          Delete = archive first (look back anytime). Permanent delete only from this shelf.
        </p>
        {templateId ? (
          <button
            type="button"
            className="btn-ghost h-8 px-3 text-[11px] text-[var(--danger)]"
            disabled={busy || disabled || !templateId}
            onClick={() => void archiveSelectedTemplate()}
          >
            Archive selected template
          </button>
        ) : null}
        {showArchivedTemplates && (
          <ul className="max-h-36 space-y-1 overflow-y-auto text-[10px]">
            {archivedTemplates.length === 0 ? (
              <li className="text-[var(--muted)]">No archived templates yet.</li>
            ) : (
              archivedTemplates.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-1 rounded border border-[var(--border)] px-2 py-1"
                >
                  <span className="min-w-0 truncate">
                    [{t.category}] {t.name}
                    {t.versionLabel ? ` · ${t.versionLabel}` : ""}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="text-accent underline"
                      disabled={busy}
                      onClick={() => void restoreTemplate(t.id)}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="text-[var(--danger)] underline"
                      disabled={busy}
                      onClick={() => void hardDeleteTemplate(t.id, t.name)}
                    >
                      Delete forever
                    </button>
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* 28-day pack */}
      <div className="space-y-2 rounded-md border border-[var(--border)] p-2">
        <p className="text-[11px] font-semibold">28-day cycle pack</p>
        <p className="text-[10px] text-[var(--muted)]">
          Capture this program&apos;s month (day numbers 1–28, Gym/Home/day-off/everything) into the
          library, or paste a pack onto a month slot (deep clone).
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className="input h-8 min-w-[12rem] flex-1 text-xs"
            value={cycleName}
            onChange={(e) => setCycleName(e.target.value)}
            placeholder="e.g. Adult Strength · M1 · v_adult"
          />
          <button
            type="button"
            className="btn-ghost h-8 px-3 text-[11px]"
            disabled={busy || disabled}
            onClick={() => void snapshotMonth()}
          >
            Save M1 → library
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="input h-8 min-w-[12rem] flex-1 text-xs"
            value={pasteCycleId}
            onChange={(e) => setPasteCycleId(e.target.value)}
          >
            <option value="">Library pack…</option>
            {libraryCycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-[10px]">
            Onto M
            <input
              type="number"
              min={1}
              max={24}
              className="input h-8 w-12 text-xs"
              value={pasteCycleMonth}
              onChange={(e) => setPasteCycleMonth(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </label>
          <button
            type="button"
            className="btn-primary h-8 px-3 text-[11px]"
            disabled={busy || disabled || !pasteCycleId}
            onClick={() => void pasteMonth()}
          >
            Paste pack
          </button>
        </div>
      </div>
    </div>
  );
}
