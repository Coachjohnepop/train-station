"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { armCalorieHorn, playCalorieRedAlert } from "@/lib/calorie-red-alert";
import {
  calorieBand,
  shouldFlashHardCalorieAlert,
  sumFoodNutrient,
  type CalorieThresholds,
  type FoodNutrients,
} from "@/lib/food-log";

type FoodRow = FoodNutrients & {
  id: string;
  eatenOn: string;
  protein: string;
  starch: string;
  fat: string;
  extras: string;
  calories: number;
  proteinG: number | null;
  carbG: number | null;
  fatG: number | null;
  source: string;
};

type DayBucket = {
  date: string;
  label: string;
  calories: number;
  entries: FoodRow[];
};

type BurnLine = { id: string; label: string; calories: number; kind: "activity" | "workout" };

type LogResponse = {
  eatenOn: string;
  dayCalories: number;
  weekCalories: number;
  thresholds: CalorieThresholds | null;
  days: DayBucket[];
  burn?: {
    weightLbs: number;
    assumedWeight: boolean;
    todayCalories: number;
    weekCalories: number;
    lines: BurnLine[];
  } | null;
};

type PhotoDraft = FoodNutrients & {
  protein: string;
  starch: string;
  fat: string;
  extras: string;
  calories: number;
  proteinG: number | null;
  carbG: number | null;
  fatG: number | null;
};

const EMPTY = { protein: "", starch: "", fat: "", extras: "" };

export default function FoodLogClient() {
  const [log, setLog] = useState<LogResponse | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [photoDraft, setPhotoDraft] = useState<PhotoDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/member/food", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as LogResponse;
    setLog(data);
    window.dispatchEvent(
      new CustomEvent("food-calories-updated", { detail: { dayCalories: data.dayCalories } }),
    );
    return data;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(key: keyof typeof EMPTY, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    armCalorieHorn();
    const beforeCalories = log?.dayCalories ?? 0;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const editing = Boolean(editingId);
      const res = await fetch(editing ? `/api/member/food/${editingId}` : "/api/member/food", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          nutrients:
            !editing &&
            photoDraft &&
            photoDraft.protein === form.protein &&
            photoDraft.starch === form.starch &&
            photoDraft.fat === form.fat &&
            photoDraft.extras === form.extras
              ? photoDraft
              : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save that meal.");
        return;
      }
      const keptLabel = Boolean(
        photoDraft &&
          photoDraft.protein === form.protein &&
          photoDraft.starch === form.starch &&
          photoDraft.fat === form.fat &&
          photoDraft.extras === form.extras,
      );
      setForm(EMPTY);
      setPhotoDraft(null);
      setEditingId(null);
      setNote(
        editing
          ? data.entry?.source === "rough"
            ? "Updated with a rough calorie guess. The AI estimate was unavailable."
            : "Updated. Calories were estimated again."
          : data.entry?.source === "rough"
            ? "Saved with a rough calorie guess. The AI estimate was unavailable."
            : keptLabel
              ? "Saved the label numbers."
              : "Saved. Calories are an estimate.",
      );
      const next = await load();
      if (next && shouldFlashHardCalorieAlert(beforeCalories, next.dayCalories, next.thresholds)) {
        playCalorieRedAlert();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError("");
    setNote("Reading that photo…");
    try {
      const image = await fileToJpegDataUrl(file);
      const res = await fetch("/api/member/food/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.draft) {
        setNote("");
        setError(typeof data.error === "string" ? data.error : "Could not read that photo.");
        return;
      }
      const next = {
        protein: data.draft.protein || "",
        starch: data.draft.starch || "",
        fat: data.draft.fat || "",
        extras: data.draft.extras || "",
      };
      if (!next.protein && !next.starch && !next.fat && !next.extras) {
        setNote("");
        setError("Could not read that photo. Try the nutrition label, closer, or type the food.");
        return;
      }
      setForm(next);
      setPhotoDraft({ ...data.draft, ...next });
      const label = nutrientLine(data.draft);
      setNote(
        label
          ? `Label read. ${data.draft.calories} calories. ${label} Check it, then save.`
          : `Photo read. About ${data.draft.calories} calories. Check the four lines, then save.`,
      );
    } catch {
      setNote("");
      setError("That photo did not go through. Try again, or take it as a JPEG.");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(row: FoodRow) {
    setEditingId(row.id);
    setForm({
      protein: row.protein,
      starch: row.starch,
      fat: row.fat,
      extras: row.extras,
    });
    setPhotoDraft(null);
    setError("");
    setNote("Change any line, then update. Calories are estimated again.");
    document.getElementById("food-entry-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
    setPhotoDraft(null);
    setNote("");
    setError("");
  }

  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/member/food/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Could not remove that line.");
        return;
      }
      if (editingId === id) cancelEdit();
      await load();
    } finally {
      setBusy(false);
    }
  }

  const today = log?.days.find((day) => day.date === log.eatenOn);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/member/today" className="text-xs font-semibold text-[var(--accent)] hover:underline">
          ← Back to Today
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Enter Eating</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Protein, starch, and the butter or oil you cooked with. Garlic, peanut butter, and the rest go in Other.
          A photo of the plate or the nutrition label works. Fiber, sugar, and sodium are kept with the meal.
          The week starts Monday.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Today</p>
          <p
            className={`mt-1 inline-flex min-w-16 justify-center rounded-full border px-3 py-1 text-3xl font-bold tabular-nums member-nav-score-badge${
              log
                ? calorieBand(log.dayCalories, log.thresholds)
                  ? ` member-nav-score-badge--cal-${calorieBand(log.dayCalories, log.thresholds)}`
                  : ""
                : ""
            }`}
          >
            {log?.dayCalories ?? 0}
          </p>
          <p className="text-xs text-[var(--muted)]">calories eaten</p>
          <NutrientTotals rows={today?.entries ?? []} />
          <BudgetNote eaten={log?.dayCalories ?? 0} thresholds={log?.thresholds ?? null} burn={log?.burn?.todayCalories ?? 0} />
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">This week</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{log?.weekCalories ?? 0}</p>
          <p className="text-xs text-[var(--muted)]">Monday through Sunday</p>
        </div>
      </div>

      <form id="food-entry-form" onSubmit={(event) => void save(event)} className="card space-y-3 p-4">
        {editingId ? (
          <p className="text-sm font-semibold">Editing this meal. Add the extra food on the line it belongs to.</p>
        ) : null}
        <Field label="Protein" hint="4 home laid chicken eggs" value={form.protein} onChange={(v) => patch("protein", v)} />
        <Field label="Starch" hint="1 piece all natural sourdough" value={form.starch} onChange={(v) => patch("starch", v)} />
        <Field label="Butter or oil" hint="Cooked in butter" value={form.fat} onChange={(v) => patch("fat", v)} />
        <Field label="Other" hint="Roasted garlic, chunky peanut butter" value={form.extras} onChange={(v) => patch("extras", v)} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary px-4 py-2 text-sm font-semibold" disabled={busy}>
            {busy ? "Saving…" : editingId ? "Update meal" : "Save meal"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold"
              disabled={busy}
              onClick={cancelEdit}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold"
            disabled={busy}
            onClick={() => document.getElementById("food-photo-input")?.click()}
          >
            {busy ? "Reading…" : "Photo"}
          </button>
          <input
            id="food-photo-input"
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              void onPhoto(file);
            }}
          />
        </div>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {note ? <p className="text-sm text-[var(--muted)]">{note}</p> : null}
      </form>

      <section className="space-y-2">
        <div className="flex items-baseline gap-3">
          <p className="text-3xl font-bold tabular-nums leading-none">{log?.dayCalories ?? 0}</p>
          <h2 className="text-lg font-semibold">Today</h2>
        </div>
        <FoodTable
          rows={today?.entries ?? []}
          editingId={editingId}
          onEdit={beginEdit}
          onRemove={(id) => void remove(id)}
          busy={busy}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Week</h2>
        {(log?.days ?? []).map((day) => (
          <div key={day.date} className="card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold">
                {day.label}
                {day.date === log?.eatenOn ? " · today" : ""}
              </h3>
              <div className="text-right">
                <p className="tabular-nums text-sm font-semibold">{day.calories} cal</p>
                {day.date === log?.eatenOn ? (
                  <BudgetNote
                    eaten={day.calories}
                    thresholds={log?.thresholds ?? null}
                    burn={log?.burn?.todayCalories ?? 0}
                    compact
                  />
                ) : null}
              </div>
            </div>
            {day.entries.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">
                {day.entries.map((row) => (
                  <li key={row.id} className="flex items-start gap-3">
                    <span className="w-14 shrink-0 text-left font-bold tabular-nums text-[var(--text)]">
                      {row.calories}
                    </span>
                    <span className="min-w-0 flex-1 text-[var(--muted)]">{foodLine(row)}</span>
                    <MealActions
                      row={row}
                      editing={editingId === row.id}
                      busy={busy}
                      onEdit={beginEdit}
                      onRemove={(id) => void remove(id)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-[var(--muted)]">Nothing logged.</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function BudgetNote({
  eaten,
  thresholds,
  burn,
  compact = false,
}: {
  eaten: number;
  thresholds: CalorieThresholds | null;
  burn: number;
  compact?: boolean;
}) {
  if (!thresholds && burn <= 0) return null;
  const room = thresholds ? Math.max(0, thresholds.rangeMax - eaten) : null;
  return (
    <p className={`text-[11px] leading-snug text-[var(--muted)] ${compact ? "" : "mt-2"}`}>
      {room != null ? `About ${room} left in today's range.` : null}
      {burn > 0 ? ` Rough burn ${burn} added to the budget.` : null}
    </p>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-semibold">{label}</span>
      <input
        className="input mt-1 w-full"
        value={value}
        placeholder={hint}
        maxLength={400}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function MealActions({
  row,
  editing,
  busy,
  onEdit,
  onRemove,
}: {
  row: FoodRow;
  editing: boolean;
  busy: boolean;
  onEdit: (row: FoodRow) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <span className="flex shrink-0 gap-2">
      <button
        type="button"
        className="text-xs font-semibold text-[var(--accent)] hover:underline"
        disabled={busy}
        onClick={() => onEdit(row)}
      >
        {editing ? "Editing" : "Edit"}
      </button>
      <button
        type="button"
        className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]"
        disabled={busy}
        onClick={() => onRemove(row.id)}
      >
        Remove
      </button>
    </span>
  );
}

function FoodTable({
  rows,
  editingId,
  onEdit,
  onRemove,
  busy,
}: {
  rows: FoodRow[];
  editingId: string | null;
  onEdit: (row: FoodRow) => void;
  onRemove: (id: string) => void;
  busy: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Nothing logged today yet.</p>;
  }
  return (
    <ul className="card divide-y divide-[var(--border)]">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start gap-3 px-3 py-2">
          <span className="w-14 shrink-0 text-left text-base font-bold tabular-nums leading-5">
            {row.calories}
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block">{foodLine(row)}</span>
            {nutrientLine(row) ? (
              <span className="mt-0.5 block text-[11px] text-[var(--muted)]">{nutrientLine(row)}</span>
            ) : null}
          </span>
          <MealActions
            row={row}
            editing={editingId === row.id}
            busy={busy}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        </li>
      ))}
    </ul>
  );
}

function foodLine(row: FoodRow): string {
  return [row.protein, row.starch, row.fat, row.extras].filter(Boolean).join(" · ") || "Meal";
}

function nutrientLine(row: FoodNutrients): string {
  const bits = [
    row.fiberG != null ? `Fiber ${row.fiberG}g` : "",
    row.sugarG != null ? `Sugar ${row.sugarG}g` : "",
    row.addedSugarG != null ? `Added sugar ${row.addedSugarG}g` : "",
    row.saturatedFatG != null ? `Sat fat ${row.saturatedFatG}g` : "",
    row.sodiumMg != null ? `Sodium ${row.sodiumMg}mg` : "",
    row.cholesterolMg != null ? `Chol ${row.cholesterolMg}mg` : "",
  ].filter(Boolean);
  if (!row.serving && bits.length === 0) return "";
  return [row.serving ? `Per ${row.serving}` : "", bits.join(" · ")].filter(Boolean).join(" · ");
}

function NutrientTotals({ rows }: { rows: FoodNutrients[] }) {
  const fiber = sumFoodNutrient(rows, "fiberG");
  const sugar = sumFoodNutrient(rows, "sugarG");
  const sodium = sumFoodNutrient(rows, "sodiumMg");
  if (fiber + sugar + sodium === 0) return null;
  return (
    <p className="mt-2 text-xs text-[var(--muted)]">
      Fiber {fiber}g · Sugar {sugar}g · Sodium {sodium}mg
    </p>
  );
}

function fileToJpegDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const max = 1600;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    image.src = url;
  });
}
