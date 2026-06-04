"use client";

import {
  formatSetCountChoice,
  setCountChoices,
  setCountFieldHint,
  setCountFieldTitle,
} from "@/lib/workout-schemes";

type Props = {
  /** Set approach id (or legacy setScheme value — normalized internally). */
  approach: string;
  value: number | "";
  onChange: (value: number) => void;
  compact?: boolean;
};

export default function SetCountStep({
  approach,
  value,
  onChange,
  compact = false,
}: Props) {
  const choices = setCountChoices(approach);

  return (
    <div>
      <p className="text-sm font-medium">{setCountFieldTitle(approach)}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {setCountFieldHint(approach)}
      </p>
      <div
        className={`mt-3 grid gap-2 ${
          choices.length <= 4
            ? "grid-cols-4"
            : compact
              ? "grid-cols-5 sm:grid-cols-10"
              : "grid-cols-5 sm:grid-cols-10"
        }`}
      >
        {choices.map((n) => (
          <button
            key={n}
            type="button"
            className={`rounded-lg border px-2 py-2.5 text-center text-sm font-semibold transition ${
              value === n
                ? "chip-selected"
                : "border-[var(--border)] chip-hover"
            }`}
            onClick={() => onChange(n)}
          >
            {formatSetCountChoice(n, approach)}
          </button>
        ))}
      </div>
    </div>
  );
}