"use client";

import { STANDARD_REP_PRESETS } from "@/lib/workout-schemes";

type Props = {
  value: string;
  onChange: (reps: string) => void;
};

export default function StandardRepsStep({ value, onChange }: Props) {
  return (
    <div>
      <p className="text-sm font-medium">Reps per set</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        e.g. 2 sets of 20 reps — pick how many reps each working set uses.
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {STANDARD_REP_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            className={`rounded-lg border px-2 py-2.5 text-center text-sm font-semibold transition ${
              value === String(n)
                ? "chip-selected"
                : "border-[var(--border)] chip-hover"
            }`}
            onClick={() => onChange(String(n))}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}