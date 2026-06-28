"use client";

type PinPadProps = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  disabled?: boolean;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;

export default function PinPad({
  value,
  onChange,
  maxLength = 4,
  disabled = false,
}: PinPadProps) {
  function press(key: (typeof KEYS)[number]) {
    if (disabled) return;
    if (key === "clear") {
      onChange("");
      return;
    }
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= maxLength) return;
    onChange(value + key);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2" aria-hidden>
        {Array.from({ length: maxLength }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full border ${
              i < value.length
                ? "border-[var(--accent)] bg-[var(--accent)]"
                : "border-[var(--border)] bg-transparent"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => {
          const label =
            key === "clear" ? "Clear" : key === "back" ? "⌫" : key;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => press(key)}
              className={`rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-3 text-lg font-medium transition hover:border-[var(--accent)]/40 disabled:opacity-50 ${
                key === "clear" || key === "back" ? "text-sm" : ""
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}