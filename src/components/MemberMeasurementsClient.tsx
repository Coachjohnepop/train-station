"use client";

import { useCallback, useEffect, useState } from "react";
import MeasurementFormFields, {
  fromLocalInputValue,
  toLocalInputValue,
} from "@/components/MeasurementFormFields";
import MeasurementsIntroModal, {
  MeasurementsIntroWatchAgainButton,
} from "@/components/MeasurementsIntroModal";
import {
  MEASUREMENT_FIELDS,
  deltaLabel,
  emptyMeasurementForm,
  formatMeasurementValue,
  type MeasurementFieldId,
  type MeasurementRecord,
} from "@/lib/body-measurements";

export default function MemberMeasurementsClient({
  introVideoUrl = null,
}: {
  introVideoUrl?: string | null;
}) {
  const [rows, setRows] = useState<MeasurementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(emptyMeasurementForm);
  const [notes, setNotes] = useState("");
  const [measuredAtLocal, setMeasuredAtLocal] = useState(() => toLocalInputValue());
  const [watchAgain, setWatchAgain] = useState(false);
  const hasVideo = Boolean(introVideoUrl?.trim());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/member/measurements", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load measurements.");
        setRows([]);
        return;
      }
      setRows(data.measurements || []);
    } catch {
      setError("Could not load measurements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setField(id: MeasurementFieldId, value: string) {
    setForm((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        notes,
        measuredAt: fromLocalInputValue(measuredAtLocal),
      };
      for (const f of MEASUREMENT_FIELDS) {
        body[f.id] = form[f.id] === "" ? null : form[f.id];
      }
      const res = await fetch("/api/member/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Save failed.");
        return;
      }
      setMessage("Check-in saved. Your coach can see this too.");
      setForm(emptyMeasurementForm());
      setNotes("");
      setMeasuredAtLocal(toLocalInputValue());
      await load();
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this check-in?")) return;
    const res = await fetch(`/api/member/measurements/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Delete failed.");
      return;
    }
    await load();
  }

  const latest = rows[0] || null;
  const previous = rows[1] || null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Measurements</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Log weight and tape measurements so you and Coach can track progress. Use the same
            points each time for fair comparisons.
          </p>
        </div>
        <MeasurementsIntroWatchAgainButton
          hasVideo={hasVideo}
          onClick={() => setWatchAgain(true)}
        />
      </div>

      <MeasurementsIntroModal
        videoUrl={introVideoUrl}
        forceOpen={watchAgain}
        onForceOpenHandled={() => setWatchAgain(false)}
      />

      {latest ? (
        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <h2 className="text-sm font-semibold">Latest check-in</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {new Date(latest.measuredAt).toLocaleString()} ·{" "}
            {latest.source === "coach" ? "Logged by coach" : "You"}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {MEASUREMENT_FIELDS.filter((f) => latest[f.id] != null).map((f) => {
              const d = previous ? deltaLabel(latest[f.id], previous[f.id]) : null;
              return (
                <div
                  key={f.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {f.label}
                  </p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatMeasurementValue(latest[f.id], f.unit)}
                  </p>
                  {d ? (
                    <p className="text-[11px] text-[var(--muted)]">
                      vs prior: <span className="tabular-nums">{d}</span>
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          {latest.notes ? (
            <p className="mt-3 text-sm text-[var(--muted)]">{latest.notes}</p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-lg font-semibold">New check-in</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Leave blank any field you skip. At least one number or a note is required.
        </p>
        <form className="mt-4 space-y-4" onSubmit={(e) => void handleSave(e)}>
          <MeasurementFormFields
            values={form}
            onChange={setField}
            notes={notes}
            onNotesChange={setNotes}
            measuredAt={measuredAtLocal}
            onMeasuredAtChange={setMeasuredAtLocal}
            disabled={saving}
          />
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary px-5 py-2.5 text-sm font-semibold"
          >
            {saving ? "Saving…" : "Save check-in"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">History</h2>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
            No check-ins yet. Add your first measurements above.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {new Date(row.measuredAt).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">
                      {row.source === "coach" ? "Coach entry" : "Member entry"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-rose-300 hover:underline"
                    onClick={() => void handleDelete(row.id)}
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-[var(--muted)]">
                  {MEASUREMENT_FIELDS.filter((f) => row[f.id] != null).map((f) => (
                    <span key={f.id}>
                      {f.label}:{" "}
                      <span className="text-[var(--text)]">
                        {formatMeasurementValue(row[f.id], f.unit)}
                      </span>
                    </span>
                  ))}
                </div>
                {row.notes ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">{row.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
