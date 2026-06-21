"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const ITEM_H = 44;
const WHEEL_VISIBLE = 3;

export function normalizeTimeValue(value: string | null | undefined, fallback = "07:30"): string {
  const match = (value || fallback).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatTime12h(value: string): string {
  const { hour12, minute, period } = parse24(value);
  return `${hour12}:${minute} ${period}`;
}

function snapMinute(minute: number): string {
  const snapped = Math.round(minute / 5) * 5;
  const clamped = snapped >= 60 ? 55 : snapped;
  return String(clamped).padStart(2, "0");
}

function parse24(value: string) {
  const normalized = normalizeTimeValue(value);
  const [hStr, mStr] = normalized.split(":");
  const hour24 = parseInt(hStr, 10);
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

function WheelColumn({
  label,
  options,
  value,
  onChange,
  ariaLabel,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userScrolling = useRef(false);

  const syncScrollToValue = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const idx = options.indexOf(value);
    if (idx < 0) return;
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) {
      el.scrollTop = target;
    }
  }, [options, value]);

  useEffect(() => {
    if (!userScrolling.current) syncScrollToValue();
  }, [syncScrollToValue]);

  function handleScroll() {
    const el = ref.current;
    if (!el) return;
    userScrolling.current = true;
    if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(options.length - 1, idx));
      const next = options[clamped];
      el.scrollTop = clamped * ITEM_H;
      if (next !== value) onChange(next);
      userScrolling.current = false;
    }, 80);
  }

  return (
    <div className="relative min-w-0 flex-1">
      <span className="mb-1 block text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 border-y border-[var(--accent)]/35 bg-[var(--accent)]/8"
          style={{ height: ITEM_H }}
        />
        <div
          ref={ref}
          role="listbox"
          aria-label={ariaLabel}
          className="time-wheel-column no-scrollbar overflow-y-auto scroll-smooth"
          style={{
            height: ITEM_H * WHEEL_VISIBLE,
            paddingTop: ITEM_H,
            paddingBottom: ITEM_H,
            scrollSnapType: "y mandatory",
          }}
          onScroll={handleScroll}
        >
          {options.map((opt) => (
            <div
              key={opt}
              role="option"
              aria-selected={opt === value}
              className="flex items-center justify-center text-lg font-semibold text-[var(--foreground)]"
              style={{ height: ITEM_H, scrollSnapAlign: "center" }}
            >
              {opt}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimeWheels({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const { hour12, minute, period } = parse24(value);

  function update(part: "hour" | "minute" | "period", next: string) {
    const h = part === "hour" ? next : hour12;
    const m = part === "minute" ? next : minute;
    const p = (part === "period" ? next : period) as "AM" | "PM";
    onChange(to24(h, m, p));
  }

  return (
    <div className={`flex items-stretch gap-2 ${className}`}>
      <WheelColumn
        label="Hour"
        options={HOUR_OPTIONS}
        value={hour12}
        onChange={(h) => update("hour", h)}
        ariaLabel="Hour"
      />
      <WheelColumn
        label="Min"
        options={MINUTE_OPTIONS}
        value={minute}
        onChange={(m) => update("minute", m)}
        ariaLabel="Minute"
      />
      <WheelColumn
        label="AM/PM"
        options={["AM", "PM"]}
        value={period}
        onChange={(p) => update("period", p)}
        ariaLabel="AM or PM"
      />
    </div>
  );
}

export default function TimeScrollPicker({
  value,
  onChange,
  id,
  className = "",
  placeholder = "Set time",
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  /** @deprecated All pickers are tap-to-open; kept for call-site compat */
  compact?: boolean;
}) {
  const uid = useId();
  const panelId = id || uid;
  const normalized = normalizeTimeValue(value || "07:30");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(normalized);
  const hasValue = Boolean(value?.trim());

  useEffect(() => {
    if (open) setDraft(normalized);
  }, [open, normalized]);

  return (
    <div className={className}>
      <button
        type="button"
        id={panelId}
        onClick={() => setOpen(true)}
        className="input flex w-full min-h-[44px] items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium"
      >
        <span>{hasValue ? formatTime12h(normalized) : placeholder}</span>
        <span className="text-[10px] text-[var(--muted)]">▾</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close time picker"
            className="absolute inset-0"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-labelledby={`${panelId}-title`}
            className="relative z-10 w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl"
          >
            <p id={`${panelId}-title`} className="mb-3 text-center text-sm font-semibold">
              Choose time
            </p>
            <TimeWheels value={draft} onChange={setDraft} />
            <button
              type="button"
              className="btn-primary mt-4 w-full py-3 text-sm font-semibold"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}