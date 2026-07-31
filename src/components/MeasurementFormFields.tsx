"use client";

import {
  MEASUREMENT_FIELDS,
  type MeasurementFieldId,
} from "@/lib/body-measurements";

type Props = {
  values: Record<MeasurementFieldId, string>;
  onChange: (id: MeasurementFieldId, value: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  measuredAt: string;
  onMeasuredAtChange: (isoLocal: string) => void;
  disabled?: boolean;
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

      <div className="grid gap-3 sm:grid-cols-2">
        {MEASUREMENT_FIELDS.map((field) => (
          <label key={field.id} className="block text-sm">
            <span className="font-medium">
              {field.label}{" "}
              <span className="text-[var(--muted)] font-normal">({field.unit})</span>
            </span>
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
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm tabular-nums"
            />
            {field.hint ? (
              <span className="mt-0.5 block text-[11px] text-[var(--muted)]">{field.hint}</span>
            ) : null}
          </label>
        ))}
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
