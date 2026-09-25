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

type BurnLine = {
  id: string;
  label: string;
  calories: number;
  minutes: number;
  kind: "activity" | "workout";
};

type DayBurn = {
  weightLbs: number;
  assumedWeight: boolean;
  sedentaryCalories: number;
  todayCalories: number;
  weekCalories: number;
  lines: BurnLine[];
};

type LogResponse = {
  eatenOn: string;
  dayCalories: number;
  weekCalories: number;
  thresholds: CalorieThresholds | null;
  days: DayBucket[];
  burn?: DayBurn | null;
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

  const todayRows = today?.entries ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold">Eating Log</h1>
        <Link href="/member/today" className="text-xs font-semibold text-[var(--accent)] hover:underline">
          Today
        </Link>
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

      {log ? (
        <TodayBoard
          rows={todayRows}
          eaten={log.dayCalories}
          thresholds={log.thresholds}
          burn={log.burn ?? null}
        />
      ) : (
        <section className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Today</p>
        </section>
      )}

      <FoodTable
        rows={todayRows}
        editingId={editingId}
        onEdit={beginEdit}
        onRemove={(id) => void remove(id)}
        busy={busy}
      />

      {(log?.days ?? []).some((day) => day.date !== log?.eatenOn && day.entries.length > 0) ? (
        <section className="space-y-3">
          {(log?.days ?? [])
            .filter((day) => day.date !== log?.eatenOn && day.entries.length > 0)
            .map((day) => (
              <div key={day.date} className="card p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold">{day.label}</h2>
                  <p className="tabular-nums text-sm font-semibold">{day.calories}</p>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {day.entries.map((row) => (
                    <li key={row.id} className="flex items-start gap-3">
                      <span className="w-14 shrink-0 text-left font-bold tabular-nums">{row.calories}</span>
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
              </div>
            ))}
        </section>
      ) : null}
    </div>
  );
}

function TodayBoard({
  rows,
  eaten,
  thresholds,
  burn,
}: {
  rows: FoodRow[];
  eaten: number;
  thresholds: CalorieThresholds | null;
  burn: DayBurn | null;
}) {
  const proteinKnown = rows.length === 0 || rows.some((row) => row.proteinG != null);
  const protein = Math.round(rows.reduce((sum, row) => sum + (row.proteinG ?? 0), 0));
  const band = calorieBand(eaten, thresholds);
  const extra = burn?.todayCalories ?? 0;
  const sitting = burn?.sedentaryCalories ?? 0;
  const workout = (burn?.lines ?? [])
    .filter((line) => line.kind === "workout")
    .reduce((sum, line) => sum + line.calories, 0);
  const budget =
    thresholds && thresholds.rangeMax > 0 ? Math.round((eaten / thresholds.rangeMax) * 100) : null;
  const offset = extra > 0 ? offsetSentence(eaten, extra) : null;

  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Today</p>
        <p className="text-sm font-semibold tabular-nums">
          {proteinKnown ? `Protein ${protein}g` : "Protein —"}
        </p>
      </div>

      {burn ? (
        <div className="space-y-1.5 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span>
              Sitting
              <span className="text-[var(--muted)]"> · {Math.round(burn.weightLbs)} lb</span>
            </span>
            <span className="tabular-nums">{sitting}</span>
          </div>
          {burn.lines.map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-3">
              <span className="min-w-0 leading-snug">
                {line.label}
                <span className="whitespace-nowrap text-[var(--muted)]">
                  {" "}
                  · {formatMinutes(line.minutes)}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">+{line.calories}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 border-t border-[var(--border)] pt-1.5 font-semibold">
            <span>Burn</span>
            <span className="tabular-nums">{sitting + extra}</span>
          </div>
        </div>
      ) : null}

      <div className="flex items-baseline justify-between gap-3">
        <p
          className={`inline-flex min-w-16 justify-center rounded-full border px-3 py-1 text-2xl font-bold tabular-nums member-nav-score-badge${
            band ? ` member-nav-score-badge--cal-${band}` : ""
          }`}
        >
          {eaten}
        </p>
        <p className="text-xs text-[var(--muted)]">calories eaten</p>
      </div>

      {workout > 0 ? (
        <p className="text-sm">
          Today&apos;s workout burned <span className="font-semibold tabular-nums">{workout}</span>.
        </p>
      ) : null}
      {offset ? <p className="text-sm">{offset}</p> : null}
      {budget != null ? (
        <p className="text-sm font-semibold tabular-nums">{budget}% of today&apos;s budget</p>
      ) : null}
      <NutrientTotals rows={rows} />
    </section>
  );
}

function offsetSentence(eaten: number, extra: number): string {
  if (eaten >= extra) {
    const left = eaten - extra;
    return left > 0
      ? `Food offset the extra burn, with ${left} left over.`
      : "Food offset the extra burn.";
  }
  return `Food offset ${eaten} of the ${extra} extra burn.`;
}

function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours <= 0) return `${total} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
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
