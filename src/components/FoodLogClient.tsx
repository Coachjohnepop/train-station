"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { armCalorieHorn, playCalorieRedAlert } from "@/lib/calorie-red-alert";
import { calorieBand, crossedHardCalorieLine, type CalorieThresholds } from "@/lib/food-log";

type FoodRow = {
  id: string;
  eatenOn: string;
  protein: string;
  starch: string;
  fat: string;
  extras: string;
  calories: number;
  source: string;
};

type DayBucket = {
  date: string;
  label: string;
  calories: number;
  entries: FoodRow[];
};

type LogResponse = {
  eatenOn: string;
  dayCalories: number;
  weekCalories: number;
  thresholds: CalorieThresholds | null;
  days: DayBucket[];
};

const EMPTY = { protein: "", starch: "", fat: "", extras: "" };

export default function FoodLogClient() {
  const [log, setLog] = useState<LogResponse | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

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
      const res = await fetch("/api/member/food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save that meal.");
        return;
      }
      setForm(EMPTY);
      setNote(
        data.entry?.source === "rough"
          ? "Saved with a rough calorie guess. The AI estimate was unavailable."
          : "Saved. Calories are an estimate.",
      );
      const next = await load();
      if (next && crossedHardCalorieLine(beforeCalories, next.dayCalories, next.thresholds)) {
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
    setNote("");
    try {
      const image = await readPhoto(file);
      const res = await fetch("/api/member/food/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.draft) {
        setError(typeof data.error === "string" ? data.error : "Could not read that photo.");
        return;
      }
      setForm({
        protein: data.draft.protein || "",
        starch: data.draft.starch || "",
        fat: data.draft.fat || "",
        extras: data.draft.extras || "",
      });
      setNote(
        `Photo read. About ${data.draft.calories} calories. Check the four lines, then save.`,
      );
    } finally {
      setBusy(false);
    }
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
        <h1 className="mt-3 text-2xl font-bold">Enter your eating</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Protein, starch, and the butter or oil you cooked with. Garlic, peanut butter, and the rest go in Other.
          Calories are an estimate. The week starts Monday.
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
          <p className="text-xs text-[var(--muted)]">calories</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">This week</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{log?.weekCalories ?? 0}</p>
          <p className="text-xs text-[var(--muted)]">Monday through Sunday</p>
        </div>
      </div>

      <form onSubmit={(event) => void save(event)} className="card space-y-3 p-4">
        <Field label="Protein" hint="4 home laid chicken eggs" value={form.protein} onChange={(v) => patch("protein", v)} />
        <Field label="Starch" hint="1 piece all natural sourdough" value={form.starch} onChange={(v) => patch("starch", v)} />
        <Field label="Butter or oil" hint="Cooked in butter" value={form.fat} onChange={(v) => patch("fat", v)} />
        <Field label="Other" hint="Roasted garlic, chunky peanut butter" value={form.extras} onChange={(v) => patch("extras", v)} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary px-4 py-2 text-sm font-semibold" disabled={busy}>
            {busy ? "Saving…" : "Save meal"}
          </button>
          <label className="cursor-pointer text-sm font-semibold text-[var(--accent)]">
            Photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                void onPhoto(file);
              }}
            />
          </label>
        </div>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {note ? <p className="text-sm text-[var(--muted)]">{note}</p> : null}
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Today</h2>
        <FoodTable rows={today?.entries ?? []} onRemove={(id) => void remove(id)} busy={busy} />
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
              <p className="tabular-nums text-sm font-semibold">{day.calories} cal</p>
            </div>
            {day.entries.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                {day.entries.map((row) => (
                  <li key={row.id}>{lineSummary(row)}</li>
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

function FoodTable({
  rows,
  onRemove,
  busy,
}: {
  rows: FoodRow[];
  onRemove: (id: string) => void;
  busy: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Nothing logged today yet.</p>;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2 font-semibold">Protein</th>
            <th className="px-3 py-2 font-semibold">Starch</th>
            <th className="px-3 py-2 font-semibold">Butter / oil</th>
            <th className="px-3 py-2 font-semibold">Other</th>
            <th className="px-3 py-2 font-semibold">Cal</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[var(--border)]">
              <td className="px-3 py-2">{row.protein || "—"}</td>
              <td className="px-3 py-2">{row.starch || "—"}</td>
              <td className="px-3 py-2">{row.fat || "—"}</td>
              <td className="px-3 py-2">{row.extras || "—"}</td>
              <td className="px-3 py-2 tabular-nums font-semibold">{row.calories}</td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]"
                  disabled={busy}
                  onClick={() => onRemove(row.id)}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function lineSummary(row: FoodRow): string {
  return [row.protein, row.starch, row.fat, row.extras].filter(Boolean).join(" · ") || "Meal";
}

function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}
