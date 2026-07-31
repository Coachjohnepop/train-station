"use client";

import {
  MEASUREMENT_FIELDS,
  formatMeasurementValue,
  type MeasurementFieldId,
  type MeasurementValues,
} from "@/lib/body-measurements";

type Props = {
  values: Record<MeasurementFieldId, string>;
  onChange: (id: MeasurementFieldId, value: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  measuredAt: string;
  onMeasuredAtChange: (isoLocal: string) => void;
  disabled?: boolean;
  /** All-time first value per field (left column, read-only). */
  originals?: MeasurementValues | null;
};

/** datetime-local value from ISO or now. */
export function toLocalInputValue(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return toLocalInputValue(null);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export default function MeasurementFormFields({
  values,
  onChange,
  notes,
  onNotesChange,
  measuredAt,
  onMeasuredAtChange,
  disabled,
  originals = null,
}: Props) {
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium">Date measured</span>
        <input
          type="datetime-local"
          value={measuredAt}
          onChange={(e) => onMeasuredAtChange(e.target.value)}
          disabled={disabled}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
        />
      </label>

      <p className="text-[11px] text-[var(--muted)]">
        Each field: <strong className="text-[var(--text)]">Original</strong> (first ever, left) ·{" "}
        <strong className="text-[var(--text)]">Check-in</strong> (enter now, right).
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {MEASUREMENT_FIELDS.map((field) => {
          const orig = originals?.[field.id];
          return (
            <div
              key={field.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <p className="text-sm font-medium">
                {field.label}{" "}
                <span className="font-normal text-[var(--muted)]">({field.unit})</span>
              </p>
              {field.hint ? (
                <p className="text-[11px] text-[var(--muted)]">{field.hint}</p>
              ) : null}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Original
                  </p>
                  <p className="mt-0.5 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm tabular-nums text-[var(--muted)]">
                    {formatMeasurementValue(orig, field.unit)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Check-in
                  </p>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={field.step}
                    min={field.min}
                    max={field.max}
                    value={values[field.id]}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    disabled={disabled}
                    placeholder="—"
                    className="mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm tabular-nums"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <label className="block text-sm">
        <span className="font-medium">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder="How you felt, morning vs evening, etc."
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          maxLength={2000}
        />
      </label>
    </div>
  );
}
