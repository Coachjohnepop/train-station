"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatApiErrorDetail } from "@/lib/api-errors";
import {
  TEMPLATE_CATEGORY_SUGGESTIONS,
  TEMPLATE_DAY_NAME_SUGGESTIONS,
} from "@/lib/workout-template-constants";

type TemplateRow = {
  id: string;
  name: string;
  category: string;
  versionLabel: string | null;
  notes: string | null;
  workoutId: string;
  exerciseCount?: number;
  workoutName?: string;
  createdAt?: string;
  updatedAt?: string;
};

function templateRecency(t: TemplateRow): number {
  const raw = t.createdAt || t.updatedAt || "";
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

type WorkoutRow = { id: string; name: string; _count?: { exercises: number } };

type LibraryCycleRow = {
  id: string;
  name: string;
  description?: string | null;
  programId?: string | null;
};

function isWeekPack(c: LibraryCycleRow): boolean {
  return /\[week-pack\]/i.test(c.description || "") || /week pack/i.test(c.name || "");
}

type Props = {
  programSlug: string;
  /** Focused program day id */
  dayId: string | null;
  /** Multi-part day part currently open in the builder (1 = Main/AM). */
  partIndex?: number;
  /** Week currently open in the program calendar (for week-pack paste default). */
  activeWeekNumber?: number;
  /** Max weeks on this program (paste target bound). */
  durationWeeks?: number;
  /** Focused workout to promote (optional) */
  focusWorkoutId: string | null;
  focusWorkoutLabel?: string;
  disabled?: boolean;
  /** Called after a successful day paste so the builder can reload + open the new clones. */
  onPasted: (result?: {
    gymWorkoutId?: string;
    homeWorkoutId?: string;
    partIndex?: number;
    dayId?: string;
  }) => void | Promise<void>;
  onMessage?: (msg: string) => void;
};

export default function ProgramTemplatePastePanel({
  programSlug,
  dayId,
  partIndex = 1,
  activeWeekNumber = 1,
  durationWeeks = 12,
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

  // Promote form — name must be typed (not auto-copied from the open day).
  const [promoName, setPromoName] = useState("");
  const [promoCategory, setPromoCategory] = useState("general");
  const [promoVersion, setPromoVersion] = useState("");
  const [promoNotes, setPromoNotes] = useState("");

  // Paste rename — template copies must get a new title for the destination week/day.
  const [pasteContentName, setPasteContentName] = useState("");

  // 28-day cycle + week packs (both live in workout_cycles library)
  const [cycleName, setCycleName] = useState("");
  const [libraryCycles, setLibraryCycles] = useState<LibraryCycleRow[]>([]);
  const [pasteCycleId, setPasteCycleId] = useState("");
  const [pasteCycleMonth, setPasteCycleMonth] = useState(1);
  const [pasteWeekPackId, setPasteWeekPackId] = useState("");
  const [pasteWeekNumber, setPasteWeekNumber] = useState(1);
  const [showArchivedTemplates, setShowArchivedTemplates] = useState(false);
  const [archivedTemplates, setArchivedTemplates] = useState<TemplateRow[]>([]);

  const load = useCallback(async () => {
    const [tRes, wRes, cRes, archRes] = await Promise.all([
      fetch("/api/workout-templates?archive=active", { cache: "no-store" }),
      fetch("/api/workouts", { cache: "no-store" }),
      fetch("/api/workout-cycles?library=1&archive=active", { cache: "no-store" }),
      fetch("/api/workout-templates?archive=archived", { cache: "no-store" }),
    ]);
    if (tRes.ok) {
      const list = (await tRes.json()) as TemplateRow[];
      setTemplates(
        [...(Array.isArray(list) ? list : [])].sort(
          (a, b) => templateRecency(b) - templateRecency(a),
        ),
      );
    }
    if (wRes.ok) setWorkouts(await wRes.json());
    if (cRes.ok) {
      const cycles = await cRes.json();
      setLibraryCycles(
        (Array.isArray(cycles) ? cycles : []).filter(
          (c: LibraryCycleRow) => !c.programId,
        ),
      );
    }
    if (archRes.ok) {
      const list = (await archRes.json()) as TemplateRow[];
      setArchivedTemplates(
        [...(Array.isArray(list) ? list : [])].sort(
          (a, b) => templateRecency(b) - templateRecency(a),
        ),
      );
    }
  }, []);

  useEffect(() => {
    if (open) {
      void load();
      // Panel sits low on the builder — scroll it into view so coaches can see the fields.
      requestAnimationFrame(() => {
        document.getElementById("templates-paste-panel")?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    }
  }, [open, load]);

  // Default paste target to the week the coach is viewing.
  useEffect(() => {
    setPasteWeekNumber(Math.max(1, Math.min(durationWeeks, activeWeekNumber || 1)));
  }, [activeWeekNumber, durationWeeks]);

  // Clear promote name when switching the open workout — coach must enter a title deliberately.
  useEffect(() => {
    setPromoName("");
  }, [focusWorkoutId]);

  const weekPacks = useMemo(
    () => libraryCycles.filter(isWeekPack),
    [libraryCycles],
  );
  const monthPacks = useMemo(
    () => libraryCycles.filter((c) => !isWeekPack(c)),
    [libraryCycles],
  );

  const filteredTemplates = useMemo(() => {
    const base = !category
      ? templates
      : templates.filter(
          (t) => (t.category || "").trim().toLowerCase() === category.toLowerCase(),
        );
    // Newest → oldest (API already sorts; keep stable if client filters).
    return [...base].sort((a, b) => templateRecency(b) - templateRecency(a));
  }, [templates, category]);

  const selectedTemplate = useMemo(
    () => filteredTemplates.find((t) => t.id === templateId) || templates.find((t) => t.id === templateId),
    [filteredTemplates, templates, templateId],
  );

  const pasteRenameOk =
    sourceMode !== "template" ||
    (Boolean(pasteContentName.trim()) &&
      Boolean(selectedTemplate) &&
      !namesMatch(pasteContentName, selectedTemplate?.name || ""));

  /** Categories that actually have templates — used in the Pick filter (not the full suggestion list). */
  const usedCategories = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) {
      if (t.category?.trim()) set.add(t.category.trim().toLowerCase());
    }
    return [...set].sort();
  }, [templates]);

  /** Freeform suggestions when *saving* a template (type any). */
  const categories = useMemo(() => {
    const set = new Set<string>([...TEMPLATE_CATEGORY_SUGGESTIONS, ...usedCategories]);
    return [...set].sort();
  }, [usedCategories]);

  // If coach filters to a category with zero templates, the pick list looks "broken".
  useEffect(() => {
    if (category && filteredTemplates.length === 0 && templates.length > 0) {
      // keep filter; empty-state copy handles it
    }
    if (templateId && !filteredTemplates.some((t) => t.id === templateId)) {
      setTemplateId("");
      setPasteContentName("");
    }
  }, [category, filteredTemplates, templateId, templates.length]);

  // When a template is picked, seed a week-scoped name suggestion — coach can edit but must change from source.
  useEffect(() => {
    if (!templateId || sourceMode !== "template") return;
    const t = templates.find((row) => row.id === templateId);
    if (!t) return;
    const suggestion = `W${activeWeekNumber} · ${t.name}`.slice(0, 200);
    setPasteContentName(suggestion);
  }, [templateId, sourceMode, templates, activeWeekNumber]);

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
    if (sourceMode === "template" && !templateId) {
      setError("Pick a template.");
      return;
    }
    if (sourceMode === "workout" && !workoutId) {
      setError("Pick a workout.");
      return;
    }
    if (sourceMode === "template") {
      const rename = pasteContentName.trim();
      if (!rename) {
        setError("Name required for this copy (different from the template title).");
        return;
      }
      if (selectedTemplate && namesMatch(rename, selectedTemplate.name)) {
        setError(
          `Change the name — cannot reuse “${selectedTemplate.name}” on another week/day. Add week, day, or version.`,
        );
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const bodyBase =
        sourceMode === "template"
          ? {
              templateId,
              dayId,
              tracks: { gym: trackGym, home: trackHome },
              replace: true,
              partIndex,
              force: false as boolean,
              contentName: pasteContentName.trim(),
            }
          : {
              sourceWorkoutId: workoutId,
              dayId,
              tracks: { gym: trackGym, home: trackHome },
              replace: true,
              partIndex,
              force: false as boolean,
              contentName: pasteContentName.trim() || undefined,
            };

      let res = await fetch("/api/workout-templates/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyBase),
      });
      let data = await res.json().catch(() => ({}));

      if (res.status === 409 && (data.needsConfirm || data.detail === "NEEDS_CONFIRM")) {
        const occupied = Array.isArray(data.occupiedTracks)
          ? data.occupiedTracks.join(" + ")
          : "Gym/Home";
        const partLabel =
          partIndex > 1 ? `part ${partIndex}` : "this day";
        const ok = window.confirm(
          `${occupied} on ${partLabel} already has content.\n\nReplace with a fresh clone? Source template stays intact.`,
        );
        if (!ok) {
          setError("Paste canceled — existing content kept.");
          return;
        }
        bodyBase.force = true;
        res = await fetch("/api/workout-templates/paste", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyBase),
        });
        data = await res.json().catch(() => ({}));
      }

      if (!res.ok) {
        setError(
          formatApiErrorDetail(data.detail) ||
            data.message ||
            (data.detail === "RENAME_REQUIRED"
              ? "Give this copy a new name (different from the template) before pasting."
              : "Paste failed"),
        );
        return;
      }
      const tracksLabel = [trackGym && "Gym", trackHome && "Home"]
        .filter(Boolean)
        .join(" + ");
      const pastedPart =
        typeof data.partIndex === "number" ? data.partIndex : partIndex;
      const partNote = pastedPart > 1 ? ` · part ${pastedPart}` : "";
      const nameNote =
        sourceMode === "template" && pasteContentName.trim()
          ? ` as “${pasteContentName.trim()}”`
          : "";
      msg(
        `Pasted ${tracksLabel}${partNote}${nameNote} (fresh copies). Source template unchanged.`,
      );
      await onPasted({
        gymWorkoutId: typeof data.gymWorkoutId === "string" ? data.gymWorkoutId : undefined,
        homeWorkoutId: typeof data.homeWorkoutId === "string" ? data.homeWorkoutId : undefined,
        partIndex: pastedPart,
        dayId,
      });
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
      setError("Template title required — type a name before saving.");
      return;
    }
    if (name.length < 2) {
      setError("Template title must be at least 2 characters.");
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
        setError(
          formatApiErrorDetail(data.detail) ||
            (data.detail === "NAME_REQUIRED"
              ? "Template title required."
              : "Could not save template"),
        );
        return;
      }
      msg(`Saved template “${name}” — paste anytime (always a fresh copy).`);
      setSourceMode("template");
      setTemplateId(data.id);
      setPromoName("");
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

  async function pasteWeekPack() {
    if (!pasteWeekPackId) {
      setError("Pick a library week pack.");
      return;
    }
    const targetWeek = Math.max(1, Math.min(durationWeeks, pasteWeekNumber || 1));
    setBusy(true);
    setError(null);
    try {
      const body = {
        sourceCycleId: pasteWeekPackId,
        programSlug,
        targetWeekNumber: targetWeek,
        force: false as boolean,
      };
      let res = await fetch("/api/workout-cycles/week-paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let data = await res.json().catch(() => ({}));
      if (res.status === 409 || data.detail === "CONTENT_EXISTS" || data.needsConfirm) {
        const summary = data.summary || "existing workouts on this week";
        const ok = window.confirm(
          `Week ${targetWeek} already has content (${summary}).\n\nReplace it with a fresh clone from the week pack? This cannot be undone.`,
        );
        if (!ok) {
          setError("Paste cancelled — existing week left unchanged.");
          return;
        }
        body.force = true;
        res = await fetch("/api/workout-cycles/week-paste", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        data = await res.json().catch(() => ({}));
      }
      if (!res.ok) {
        setError(formatApiErrorDetail(data.detail) || data.message || "Paste week pack failed");
        return;
      }
      msg(
        `Pasted week pack onto week ${targetWeek} (${data.slotsCloned ?? "?"} Gym/Home slots cloned).`,
      );
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
        title="Paste templates, save templates, week packs, 28-day packs"
      >
        Templates & paste
      </button>
    );
  }

  const templateEmptyAll = templates.length === 0;
  const templateEmptyFilter = !templateEmptyAll && filteredTemplates.length === 0;

  return (
    <div
      id="templates-paste-panel"
      className="mt-2 max-h-[min(70vh,36rem)] space-y-3 overflow-y-auto rounded-lg border-2 border-violet-400/50 bg-[var(--surface)] p-3 text-xs shadow-[0_0_0_1px_rgba(167,139,250,0.15)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-violet-100">Templates & paste</p>
        <button type="button" className="btn-ghost px-2 py-0.5 text-[10px]" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-snug text-violet-100/95">
        <li>
          <strong className="text-[var(--text)]">Save</strong> the workout open above as a template
          (step A).
        </li>
        <li>
          Open the <strong className="text-[var(--text)]">destination day</strong> (e.g. Athletes W3
          Mon) — paste only hits the day you have open.
        </li>
        <li>
          <strong className="text-[var(--text)]">Paste as copy</strong> from the library (step B).
        </li>
      </ol>

      {error && (
        <p className="rounded border border-[var(--danger)]/40 bg-[var(--surface-2)] px-2 py-1 text-[var(--danger)]">
          {error}
        </p>
      )}

      {/* A — Save first (this is what coaches need for Adult → Athletes) */}
      <div className="space-y-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2">
        <p className="text-[11px] font-bold text-emerald-100">
          A · Save current workout as template
        </p>
        {!focusWorkoutId ? (
          <p className="rounded border border-amber-400/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-100">
            Open a day and tap <strong>Gym Workout</strong> (or Home) so a workout is loaded above —
            then you can save it here.
          </p>
        ) : (
          <p className="text-[10px] text-emerald-100/80">
            Source workout:{" "}
            <span className="font-semibold text-[var(--text)]">
              {focusWorkoutLabel || "current workout"}
            </span>
            {" · "}you must enter a <strong className="text-[var(--text)]">template title</strong>{" "}
            below (not auto-filled).
          </p>
        )}
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-emerald-100/90">
            Quick title (tap one) or type your own — required to save:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_DAY_NAME_SUGGESTIONS.map((name) => {
              const active = promoName.trim().toLowerCase() === name.toLowerCase();
              return (
                <button
                  key={name}
                  type="button"
                  disabled={busy || disabled}
                  className={
                    active
                      ? "rounded-full bg-emerald-500/40 px-2.5 py-1 text-[10px] font-semibold text-emerald-50 ring-1 ring-emerald-300/60"
                      : "rounded-full border border-emerald-500/30 bg-[var(--surface)] px-2.5 py-1 text-[10px] font-medium text-[var(--text)] hover:border-emerald-400/60 hover:bg-emerald-500/15"
                  }
                  onClick={() => setPromoName(name)}
                  title={`Use template name “${name}”`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-[var(--text)]">
            Template title <span className="text-amber-200">(required)</span>
            <input
              className="input mt-0.5 h-9 w-full text-xs text-[var(--text)]"
              value={promoName}
              onChange={(e) => setPromoName(e.target.value)}
              list="template-day-name-suggestions"
              placeholder={
                focusWorkoutLabel?.trim()
                  ? `e.g. ${focusWorkoutLabel.trim()} (type a title)`
                  : "e.g. Upper Body Workout · Leg Day · Fasted Cardio"
              }
              required
              aria-required
            />
            <datalist id="template-day-name-suggestions">
              {TEMPLATE_DAY_NAME_SUGGESTIONS.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          <label className="block text-[var(--text)]">
            Category (type any)
            <input
              className="input mt-0.5 h-9 w-full text-xs text-[var(--text)]"
              list="template-category-suggestions"
              value={promoCategory}
              onChange={(e) => setPromoCategory(e.target.value)}
              placeholder="adult, athletes, military…"
            />
            <datalist id="template-category-suggestions">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block text-[var(--text)]">
            Version tag (optional)
            <input
              className="input mt-0.5 h-9 w-full text-xs text-[var(--text)]"
              value={promoVersion}
              onChange={(e) => setPromoVersion(e.target.value)}
              placeholder="v_adult"
            />
          </label>
          <label className="block text-[var(--text)]">
            Notes (optional)
            <input
              className="input mt-0.5 h-9 w-full text-xs text-[var(--text)]"
              value={promoNotes}
              onChange={(e) => setPromoNotes(e.target.value)}
              placeholder="Your notes"
            />
          </label>
        </div>
        <button
          type="button"
          className="btn-primary h-9 px-4 text-[12px] font-semibold"
          disabled={busy || disabled || !focusWorkoutId || promoName.trim().length < 2}
          onClick={() => void promoteFocus()}
          title={
            promoName.trim().length < 2
              ? "Enter a template title first"
              : "Save a deep clone into the template library"
          }
        >
          Save to template library
        </button>
        {focusWorkoutId && promoName.trim().length < 2 && (
          <p className="text-[10px] font-medium text-amber-100">
            Enter a template title (or tap a quick name) — Save stays off until you do.
          </p>
        )}
      </div>

      {/* B — Paste onto the day open above */}
      <div className="space-y-2 rounded-md border border-violet-400/40 bg-violet-500/10 p-2">
        <p className="text-[11px] font-bold text-violet-100">
          B · Paste onto the day open above
        </p>
        <p className="text-[10px] text-[var(--muted)]">
          Destination = the calendar day/workout you already selected. Switch to Athletes (or
          Military) first if that&apos;s where you want the copy.
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1 text-[var(--text)]">
            <input
              type="radio"
              checked={sourceMode === "template"}
              onChange={() => setSourceMode("template")}
            />
            Template library
          </label>
          <label className="flex items-center gap-1 text-[var(--text)]">
            <input
              type="radio"
              checked={sourceMode === "workout"}
              onChange={() => setSourceMode("workout")}
            />
            Any workout
          </label>
        </div>

        {sourceMode === "template" ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <select
                className="input h-9 min-w-[8rem] text-xs text-[var(--text)]"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Filter by category"
              >
                <option value="">All templates ({templates.length})</option>
                {usedCategories.map((c) => {
                  const n = templates.filter(
                    (t) => (t.category || "").toLowerCase() === c,
                  ).length;
                  return (
                    <option key={c} value={c}>
                      {c} ({n})
                    </option>
                  );
                })}
              </select>
              <select
                className="input h-9 min-w-[14rem] flex-1 text-xs text-[var(--text)]"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                aria-label="Pick template (newest first)"
              >
                <option value="">
                  {templateEmptyAll
                    ? "No templates yet — use step A first"
                    : templateEmptyFilter
                      ? "None in this filter — choose All templates"
                      : `Pick template… newest first (${filteredTemplates.length})`}
                </option>
                {filteredTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.category}] {t.name}
                    {t.versionLabel ? ` · ${t.versionLabel}` : ""} (
                    {t.exerciseCount ?? "?"} ex)
                  </option>
                ))}
              </select>
            </div>
            {templateId && selectedTemplate && (
              <label className="block text-[var(--text)]">
                Name for this copy{" "}
                <span className="text-amber-200">(required — must differ from template)</span>
                <input
                  className="input mt-0.5 h-9 w-full text-xs text-[var(--text)]"
                  value={pasteContentName}
                  onChange={(e) => setPasteContentName(e.target.value)}
                  placeholder={`e.g. W${activeWeekNumber} · ${selectedTemplate.name}`}
                  required
                  aria-required
                />
                <span className="mt-0.5 block text-[10px] text-[var(--muted)]">
                  Template is “{selectedTemplate.name}”. Suggested name includes the open week so
                  W1 and W2 copies stay distinct — edit freely, but don&apos;t reuse the template
                  title alone.
                </span>
                {pasteContentName.trim() &&
                  namesMatch(pasteContentName, selectedTemplate.name) && (
                    <span className="mt-0.5 block text-[10px] font-medium text-amber-100">
                      Change this name — cannot paste with the same title as the template.
                    </span>
                  )}
              </label>
            )}
            {templateEmptyAll && (
              <p className="rounded border border-amber-400/50 bg-amber-500/15 px-2 py-2 text-[11px] font-medium text-amber-50">
                Library is empty (or you haven&apos;t saved any yet). Use{" "}
                <strong>A · Save</strong> above on an Adult day first, then come back here on the
                Athletes day to paste.
              </p>
            )}
            {templateEmptyFilter && (
              <p className="rounded border border-amber-400/50 bg-amber-500/15 px-2 py-2 text-[11px] font-medium text-amber-50">
                No templates in &quot;{category}&quot;. Switch the filter to{" "}
                <strong>All templates ({templates.length})</strong> — you should see them in the
                second dropdown.
              </p>
            )}
            {!templateEmptyAll && !templateEmptyFilter && (
              <p className="text-[10px] text-[var(--muted)]">
                {filteredTemplates.length} template{filteredTemplates.length === 1 ? "" : "s"}{" "}
                (newest → oldest) — open the second dropdown to pick one.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <select
              className="input h-9 w-full text-xs text-[var(--text)]"
              value={workoutId}
              onChange={(e) => setWorkoutId(e.target.value)}
            >
              <option value="">
                {workouts.length === 0
                  ? "No workouts loaded"
                  : `Pick workout… (${workouts.length})`}
              </option>
              {workouts.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w._count?.exercises ?? "?"} ex)
                </option>
              ))}
            </select>
            {workouts.length === 0 && (
              <p className="text-[10px] text-amber-200">
                Workout list empty — hard refresh, then reopen this panel.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-[var(--text)]">
            <input
              type="checkbox"
              checked={trackGym}
              onChange={(e) => setTrackGym(e.target.checked)}
            />
            Gym track
          </label>
          <label className="flex items-center gap-1.5 text-[var(--text)]">
            <input
              type="checkbox"
              checked={trackHome}
              onChange={(e) => setTrackHome(e.target.checked)}
            />
            Home track
          </label>
          <button
            type="button"
            className="btn-primary h-9 px-4 text-[12px] font-semibold"
            disabled={
              busy ||
              disabled ||
              !dayId ||
              (sourceMode === "template" ? !templateId || !pasteRenameOk : !workoutId)
            }
            onClick={() => void pasteWorkout()}
            title={
              sourceMode === "template" && !pasteRenameOk
                ? "Give this copy a new name (different from the template) first"
                : "Clones the selected template onto the calendar day open above"
            }
          >
            Paste as copy onto this day
          </button>
        </div>
        {sourceMode === "template" && !templateId && !templateEmptyAll && (
          <p className="text-[11px] font-medium text-amber-100">
            Pick a template in the second dropdown first — then name the copy and paste.
          </p>
        )}
        {sourceMode === "template" && templateId && !pasteRenameOk && (
          <p className="text-[11px] font-medium text-amber-100">
            Name this copy differently from the template title before paste turns on.
          </p>
        )}
        {!dayId && (
          <p className="text-[11px] font-medium text-amber-200">
            Select a day (Gym/Home) in the calendar first — paste needs a destination day open.
          </p>
        )}
        <p className="text-[10px] text-[var(--muted)]">
          Not the same as <strong className="text-[var(--text)]">Save to template library</strong>{" "}
          (that only stores a copy for later). Paste is the purple button in this section.
        </p>
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

      {/* Week pack (Mon–Sun) */}
      <div className="space-y-2 rounded-md border border-violet-400/40 p-2">
        <p className="text-[11px] font-semibold">Week packs</p>
        <p className="text-[10px] text-[var(--muted)]">
          Paste a saved Mon–Sun week (Gym/Home clones) onto a program week. Save weeks from the
          calendar header: <strong className="text-[var(--text)]">Post current week to Template Library</strong>.
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            className="input h-8 min-w-[12rem] flex-1 text-xs"
            value={pasteWeekPackId}
            onChange={(e) => setPasteWeekPackId(e.target.value)}
          >
            <option value="">
              {weekPacks.length === 0 ? "No week packs yet…" : "Week pack…"}
            </option>
            {weekPacks.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-[10px]">
            Onto W
            <input
              type="number"
              min={1}
              max={durationWeeks}
              className="input h-8 w-12 text-xs"
              value={pasteWeekNumber}
              onChange={(e) =>
                setPasteWeekNumber(
                  Math.max(1, Math.min(durationWeeks, parseInt(e.target.value, 10) || 1)),
                )
              }
            />
          </label>
          <button
            type="button"
            className="btn-primary h-8 px-3 text-[11px]"
            disabled={busy || disabled || !pasteWeekPackId}
            onClick={() => void pasteWeekPack()}
          >
            Paste week pack
          </button>
        </div>
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
            {monthPacks.map((c) => (
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
