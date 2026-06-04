"use client";

import {
  variantChoices,
  variantFieldHint,
  variantStepLabel,
} from "@/lib/workout-schemes";

type Props = {
  approach: string;
  value: string;
  onChange: (id: string) => void;
};

export default function SchemeVariantStep({
  approach,
  value,
  onChange,
}: Props) {
  const choices = variantChoices(approach);

  return (
    <div>
      <p className="text-sm font-medium">{variantStepLabel(approach)}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {variantFieldHint(approach)}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className={`rounded-lg border px-3 py-2.5 text-center text-sm font-semibold transition ${
              value === choice.id
                ? "chip-selected"
                : "border-[var(--border)] chip-hover"
            }`}
            onClick={() => onChange(choice.id)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}