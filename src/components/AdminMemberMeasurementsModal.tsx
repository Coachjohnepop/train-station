"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MeasurementFormFields, {
  fromLocalInputValue,
  toLocalInputValue,
} from "@/components/MeasurementFormFields";
import {
  MEASUREMENT_FIELDS,
  emptyMeasurementForm,
  formatMeasurementValue,
  originalValuesFromHistory,
  type MeasurementFieldId,
  type MeasurementRecord,
} from "@/lib/body-measurements";

type Props = {
  userId: string;
  memberName: string;
  onClose: () => void;
};

export default function AdminMemberMeasurementsModal({
  userId,
  memberName,
  onClose,
}: Props) {
  const [rows, setRows] = useState<MeasurementRecord[]>([]);
  const [beforePhotoUrl, setBeforePhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(emptyMeasurementForm);
  const [notes, setNotes] = useState("");
  const [measuredAtLocal, setMeasuredAtLocal] = useState(() => toLocalInputValue());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(
      `/api/admin/members/${encodeURIComponent(userId)}/measurements`,
      { cache: "no-store" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load measurements.");
      setRows([]);
      setBeforePhotoUrl(null);
    } else {
      setRows(data.measurements || []);
      setBeforePhotoUrl(
        typeof data.beforePhotoUrl === "string" && data.beforePhotoUrl.trim()
          ? data.beforePhotoUrl.trim()
          : null,
      );
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const originals = useMemo(() => originalValuesFromHistory(rows), [rows]);

  function setField(id: MeasurementFieldId, value: string) {
    setForm((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        notes,
        measuredAt: fromLocalInputValue(measuredAtLocal),
      };
      for (const f of MEASUREMENT_FIELDS) {
        body[f.id] = form[f.id] === "" ? null : form[f.id];
      }
      const res = await fetch(
        `/api/admin/members/${encodeURIComponent(userId)}/measurements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Save failed.");
        return;
      }
      setMessage("Saved for member.");
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
    const res = await fetch(
      `/api/admin/members/${encodeURIComponent(userId)}/measurements?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Delete failed.");
      return;
    }
    await load();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Measurements</h2>
            <p className="text-sm text-[var(--muted)]">{memberName}</p>
          </div>
          <button type="button" className="btn-ghost text-xs" onClick={onClose}>
            Close
          </button>
        </div>

        {beforePhotoUrl ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={beforePhotoUrl}
              alt="Before photo"
              className="h-24 w-18 shrink-0 rounded object-cover object-top"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Before portrait
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">Member baseline photo</p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-[var(--muted)]">No before photo uploaded yet.</p>
        )}

        <form className="mt-4 space-y-3 border-b border-[var(--border)] pb-4" onSubmit={(e) => void handleSave(e)}>
          <h3 className="text-sm font-semibold">Log check-in as coach</h3>
          <MeasurementFormFields
            values={form}
            onChange={setField}
            notes={notes}
            onNotesChange={setNotes}
            measuredAt={measuredAtLocal}
            onMeasuredAtChange={setMeasuredAtLocal}
            disabled={saving}
            originals={originals}
          />
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary px-4 py-2 text-sm font-semibold"
          >
            {saving ? "Saving…" : "Save check-in"}
          </button>
        </form>

        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold">History</h3>
          {loading ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No check-ins yet.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(row.measuredAt).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {row.source === "coach" ? "Coach" : "Member"}
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
                  <div className="mt-1 flex flex-wrap items-start gap-2">
                    {row.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.photoUrl}
                        alt="Check-in"
                        className="h-14 w-11 shrink-0 rounded object-cover object-top"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-[var(--muted)]">
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
                        <p className="mt-1 text-xs text-[var(--muted)]">{row.notes}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
