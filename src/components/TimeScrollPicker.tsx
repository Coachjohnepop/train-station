"use client";

const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));

export function normalizeTimeValue(value: string | null | undefined, fallback = "07:30"): string {
  const match = (value || fallback).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function snapMinute(minute: number): string {
  const snapped = Math.round(minute / 5) * 5;
  const clamped = snapped >= 60 ? 55 : snapped;
  return String(clamped).padStart(2, "0");
}

function parse24(value: string) {
  const normalized = normalizeTimeValue(value);
  const [hStr, mStr] = normalized.split(":");
  let hour24 = parseInt(hStr, 10);
  const minute = snapMinute(parseInt(mStr, 10));
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12: String(hour12), minute, period };
}

function to24(hour12: string, minute: string, period: "AM" | "PM"): string {
  let h = parseInt(hour12, 10);
  if (period === "AM") {
    if (h === 12) h = 0;
  } else if (h !== 12) {
    h += 12;
  }
  return `${String(h).padStart(2, "0")}:${minute}`;
}

export default function TimeScrollPicker({
  value,
  onChange,
  id,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  className?: string;
}) {
  const { hour12, minute, period } = parse24(value);

  function update(part: "hour" | "minute" | "period", next: string) {
    const h = part === "hour" ? next : hour12;
    const m = part === "minute" ? next : minute;
    const p = (part === "period" ? next : period) as "AM" | "PM";
    onChange(to24(h, m, p));
  }

  const selectClass =
    "time-scroll-select flex-1 min-w-0 appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-3 text-center text-base font-medium text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]";

  return (
    <div id={id} className={`flex items-stretch gap-2 ${className}`}>
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted)] text-center">Hour</span>
        <select
          aria-label="Reminder hour"
          value={hour12}
          onChange={(e) => update("hour", e.target.value)}
          className={selectClass}
        >
          {HOUR_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted)] text-center">Min</span>
        <select
          aria-label="Reminder minute"
          value={minute}
          onChange={(e) => update("minute", e.target.value)}
          className={selectClass}
        >
          {MINUTE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted)] text-center">AM/PM</span>
        <select
          aria-label="Reminder AM or PM"
          value={period}
          onChange={(e) => update("period", e.target.value)}
          className={selectClass}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}