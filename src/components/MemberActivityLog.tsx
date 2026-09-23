"use client";

import { useEffect, useState } from "react";

const EXAMPLES = [
  "20 wheelbarrow loads of dirt taken 100 feet",
  "30 mins fasted cardio",
  "Lower body stretching for 10 mins",
  "Full body stretch for 15 mins",
  "Rode stationary bike for 10 mins",
  "Rode horse for 1 hour",
];

type Entry = { id: string; text: string };

export function MemberActivityLogButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs">
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
          open
            ? "bg-accent text-[var(--text)] shadow-sm"
            : "text-[var(--muted)] hover:text-[var(--text)]"
        }`}
        aria-expanded={open}
        aria-label={open ? "Close activity log" : "Open activity log"}
        onClick={onToggle}
      >
        Activity Log
        <svg
          aria-hidden
          viewBox="0 0 10 6"
          className={`h-1.5 w-2.5 shrink-0 fill-current transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M0 0h10L5 6z" />
        </svg>
      </button>
    </div>
  );
}

export function MemberActivityLogPanel({ open }: { open: boolean }) {
  const [text, setText] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pointsToday, setPointsToday] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    void fetch("/api/member/activity", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setEntries(data.entries || []);
        setPointsToday(data.pointsToday || 0);
      })
      .catch(() => {});
  }, [open]);

  async function save(next = text) {
    const value = next.trim();
    if (value.length < 3 || busy) return;
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/member/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(typeof data.error === "string" ? data.error : "Could not save that.");
        return;
      }
      setEntries((rows) => [...rows, data.entry]);
      setText("");
      if (data.pointsEarned > 0) {
        setPointsToday(5);
        setNote("Saved. +5 points for today. This is not a workout.");
        if (typeof data.totalPoints === "number") {
          window.dispatchEvent(
            new CustomEvent("member-score-updated", { detail: { totalPoints: data.totalPoints } }),
          );
        }
      } else {
        setNote("Saved. You already have today's 5 points. This is not a workout.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
        <div className="card w-full space-y-3 p-3 text-left">
          <p className="text-xs text-[var(--muted)]">
            Extra work from the day. It does not count as your workout, and it adds 5 points once today.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={240}
            rows={3}
            placeholder="What did you do?"
            className="input w-full text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="rounded-full border border-[var(--border)] px-2 py-1 text-left text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
                onClick={() => setText(example)}
              >
                {example}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-sm font-semibold"
            disabled={busy || text.trim().length < 3}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Add"}
          </button>
          {note ? <p className="text-xs text-[var(--muted)]">{note}</p> : null}
          {entries.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {entries.map((entry) => (
                <li key={entry.id} className="text-[var(--text)]">
                  {entry.text}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-[11px] text-[var(--muted)]">Points from activity today: {pointsToday} / 5</p>
        </div>
  );
}
