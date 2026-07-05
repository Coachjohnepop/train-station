"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PrescriptionRowEditor from "@/components/PrescriptionRowEditor";
import {
  PATTERN_TYPE_LABELS,
  type PrescriptionExampleRow,
  type PrescriptionPatternType,
} from "@/lib/prescription-example-types";
import { formatApiErrorDetail } from "@/lib/api-errors";

export default function PrescriptionExamplesReview() {
  const [rows, setRows] = useState<PrescriptionExampleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<PrescriptionPatternType | "all">("all");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/prescription-examples", { cache: "no-store" });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(formatApiErrorDetail(body?.detail) || "Could not load prescription examples.");
      setLoading(false);
      return;
    }
    setRows(body.examples ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const filtered =
      filter === "all" ? rows : rows.filter((r) => r.patternType === filter);
    const map = new Map<PrescriptionPatternType, PrescriptionExampleRow[]>();
    for (const row of filtered) {
      const list = map.get(row.patternType) ?? [];
      list.push(row);
      map.set(row.patternType, list);
    }
    return [...map.entries()];
  }, [rows, filter]);

  const editingRow = rows.find((r) => r.id === editingId) ?? null;

  async function saveRow(draft: PrescriptionExampleRow) {
    setMessage(null);
    const res = await fetch(`/api/admin/prescription-examples/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(formatApiErrorDetail(body?.detail) || "Save failed.");
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === draft.id ? body.example : r)));
    setEditingId(null);
    setMessage(`Saved example #${draft.id}.`);
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading prescription patterns…</p>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
          {message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Filter pattern:</span>
        <button
          type="button"
          className={`btn-ghost text-sm ${filter === "all" ? "ring-2 ring-accent" : ""}`}
          onClick={() => setFilter("all")}
        >
          All ({rows.length})
        </button>
        {[...new Set(rows.map((r) => r.patternType))].map((pattern) => (
          <button
            key={pattern}
            type="button"
            className={`btn-ghost text-sm ${filter === pattern ? "ring-2 ring-accent" : ""}`}
            onClick={() => setFilter(pattern)}
          >
            {PATTERN_TYPE_LABELS[pattern]} ({rows.filter((r) => r.patternType === pattern).length})
          </button>
        ))}
      </div>

      {editingRow && (
        <PrescriptionRowEditor
          exerciseName={editingRow.sampleExercise}
          initial={editingRow}
          allowPatternChange={false}
          confirmLabel="Save example"
          onConfirm={(draft) => void saveRow({ ...editingRow, ...draft })}
          onCancel={() => setEditingId(null)}
        />
      )}

      {grouped.map(([pattern, patternRows]) => (
        <section key={pattern} className="card space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{PATTERN_TYPE_LABELS[pattern]}</h2>
            <p className="text-sm text-[var(--muted)]">
              {patternRows.length} example{patternRows.length === 1 ? "" : "s"} — tap Edit on any
              row Jeremy wants to tweak.
            </p>
          </div>
          <div className="table-wrap overflow-x-auto">
            <table className="data min-w-[56rem]">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Exercise</th>
                  <th>Sets</th>
                  <th>Rest</th>
                  <th>Weight</th>
                  <th>Summary</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {patternRows.map((row) => (
                  <tr key={row.id}>
                    <td className="text-[var(--muted)]">{row.id}</td>
                    <td>{row.sampleExercise}</td>
                    <td>{row.setCount}</td>
                    <td>{row.restBetweenSetsSec}s</td>
                    <td className="capitalize">{row.weightTier}</td>
                    <td className="max-w-xs text-sm">{row.summary}</td>
                    <td className="max-w-[10rem] truncate text-xs text-[var(--muted)]">
                      {row.notes || "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="text-sm font-semibold text-accent"
                        onClick={() => {
                          setEditingId(row.id);
                          setMessage(null);
                          setError(null);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}