"use client";

import { useCallback, useEffect, useState } from "react";
import { DAY_LABELS } from "@/lib/program-constants";

type ProgramPosition = {
  programSlug: string;
  programName: string;
  currentWeek: number;
  currentDay: number;
  enrollmentDayNumber: number;
  durationWeeks: number;
};

type Props = {
  userId: string;
  memberName?: string | null;
};

export default function AdminMemberProgramPositionPanel({ userId, memberName }: Props) {
  const [positions, setPositions] = useState<ProgramPosition[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("adult");
  const [week, setWeek] = useState(1);
  const [day, setDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = positions.find((p) => p.programSlug === selectedSlug) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(userId)}/program-position`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Could not load program position");
        setPositions([]);
        return;
      }
      const list: ProgramPosition[] = data.positions ?? (data.programSlug ? [data] : []);
      setPositions(list);
      const primary = list.find((p) => p.programSlug === "adult") ?? list[0];
      if (primary) {
        setSelectedSlug(primary.programSlug);
        setWeek(primary.currentWeek);
        setDay(primary.currentDay);
      }
    } catch {
      setError("Could not load program position");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setWeek(selected.currentWeek);
    setDay(selected.currentDay);
  }, [selected?.programSlug, selected?.currentWeek, selected?.currentDay]);

  async function save() {
    if (!selectedSlug) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(userId)}/program-position`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programSlug: selectedSlug,
            currentWeek: week,
            currentDay: day,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Save failed");
        return;
      }
      setMessage(
        `Saved — ${memberName || "Member"} is on Day ${data.enrollmentDayNumber} (${DAY_LABELS[data.currentDay - 1]}, Week ${data.currentWeek}).`,
      );
      await load();
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-xs text-[var(--muted)]">Loading program position…</p>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-[var(--muted)]">
        <p className="font-semibold text-[var(--text)]">Program start position</p>
        <p className="mt-1">
          Not enrolled in a workout program yet. Enroll via Programs or signup first.
        </p>
      </div>
    );
  }

  const previewDayN = (week - 1) * 7 + day;
  const maxWeek = selected?.durationWeeks ?? 4;

  return (
    <div className="rounded-lg border border-accent/25 bg-accent/5 p-3">
      <p className="text-xs font-semibold text-[var(--text)]">Program start position</p>
      <p className="mt-0.5 text-[10px] text-[var(--muted)]">
        Sets where they are in the program (Day N on member Today). Tuesday enroll = set Week 1,
        Day 2.
      </p>

      {positions.length > 1 && (
        <label className="mt-3 block">
          <span className="text-[10px] text-[var(--muted)]">Program</span>
          <select
            className="input mt-1 w-full text-sm"
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
          >
            {positions.map((p) => (
              <option key={p.programSlug} value={p.programSlug}>
                {p.programName}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] text-[var(--muted)]">Week</span>
          <input
            type="number"
            min={1}
            max={maxWeek}
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="input mt-1 w-full tabular-nums"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-[var(--muted)]">Day (1=Mon … 7=Sun)</span>
          <select
            className="input mt-1 w-full text-sm"
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
          >
            {DAY_LABELS.map((label, idx) => (
              <option key={label} value={idx + 1}>
                {label} (Day {idx + 1})
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-2 text-[11px] text-[var(--muted)]">
        Member will see <strong className="text-[var(--text)]">Day {previewDayN}</strong> on Today
        {selected ? ` · ${selected.programName}` : ""}.
      </p>

      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
      {message && <p className="mt-2 text-xs text-[var(--success)]">{message}</p>}

      <button
        type="button"
        className="btn-primary mt-3 w-full text-sm"
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save program position"}
      </button>
    </div>
  );
}