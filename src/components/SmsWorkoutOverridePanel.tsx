"use client";

import { useEffect, useMemo, useState } from "react";

type ProgramDay = {
  id: string;
  dayNumber: number;
  smsWorkoutText?: string | null;
  smsOverrideActive?: boolean;
  replacesLiveSession?: boolean;
  smsOverrideLabel?: string | null;
};

type ProgramWeek = {
  weekNumber: number;
  days: ProgramDay[];
};

type Program = {
  slug: string;
  name: string;
  weeks: ProgramWeek[];
};

type Recipient = { id: string; email: string; name?: string | null; phone?: string | null };

export default function SmsWorkoutOverridePanel({
  programs,
  recipients = [],
}: {
  programs: Program[];
  recipients?: Recipient[];
}) {
  const [programSlug, setProgramSlug] = useState(programs[0]?.slug || "adult");
  const [weekNumber, setWeekNumber] = useState(1);
  const [dayNumber, setDayNumber] = useState(1);
  const [smsText, setSmsText] = useState("");
  const [label, setLabel] = useState("Coach SMS workout");
  const [active, setActive] = useState(true);
  const [replacesLiveSession, setReplacesLiveSession] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const program = useMemo(
    () => programs.find((p) => p.slug === programSlug) || programs[0],
    [programs, programSlug],
  );

  const week = program?.weeks.find((w) => w.weekNumber === weekNumber);
  const day = week?.days.find((d) => d.dayNumber === dayNumber);

  useEffect(() => {
    if (!day) return;
    if (day.smsOverrideActive && day.smsWorkoutText) {
      setSmsText(day.smsWorkoutText);
      setLabel(day.smsOverrideLabel || "Coach SMS workout");
      setReplacesLiveSession(!!day.replacesLiveSession);
      setActive(true);
    }
  }, [day?.id, day?.smsOverrideActive, day?.smsWorkoutText, day?.smsOverrideLabel, day?.replacesLiveSession]);

  useEffect(() => {
    setSelectedIds(recipients.filter((r) => r.phone).map((r) => r.id));
  }, [recipients]);

  async function saveOverride() {
    if (!day || !smsText.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/schedule-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayId: day.id,
          programSlug,
          weekNumber,
          dayNumber,
          smsWorkoutText: smsText.trim(),
          active,
          replacesLiveSession,
          label,
          sendSms,
          userIds: sendSms ? selectedIds : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage("Save failed: " + (err.detail || res.statusText));
        return;
      }
      const data = await res.json();
      const smsNote = data.sms?.sent ? ` SMS sent to ${data.sms.sent} member(s).` : "";
      setMessage(`Schedule override saved.${smsNote}`);
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setSaving(false);
    }
  }

  async function clearOverride() {
    if (!day) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/schedule-overrides?dayId=${encodeURIComponent(day.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setMessage("Could not clear override.");
        return;
      }
      setSmsText("");
      setActive(false);
      setMessage("Override cleared — schedule shows the normal workout again.");
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  if (!program || !day) {
    return <p className="text-sm text-[var(--muted)]">No program days loaded for SMS overrides.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted)]">
        Paste the workout text you would normally send by SMS. When active, it overrides what members see on that schedule day
        (useful when there is no live session).
      </p>

      {message && <p className="text-sm text-[var(--success)]">{message}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs">
          <span className="text-[var(--muted)]">Program</span>
          <select className="input mt-1 w-full" value={programSlug} onChange={(e) => setProgramSlug(e.target.value)}>
            {programs.map((p) => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-[var(--muted)]">Week</span>
          <select className="input mt-1 w-full" value={weekNumber} onChange={(e) => setWeekNumber(parseInt(e.target.value, 10))}>
            {program.weeks.map((w) => (
              <option key={w.weekNumber} value={w.weekNumber}>Week {w.weekNumber}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-[var(--muted)]">Day</span>
          <select className="input mt-1 w-full" value={dayNumber} onChange={(e) => setDayNumber(parseInt(e.target.value, 10))}>
            {week?.days.map((d) => (
              <option key={d.id} value={d.dayNumber}>Day {d.dayNumber}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-xs">
        <span className="text-[var(--muted)]">Override label (shown on schedule)</span>
        <input className="input mt-1 w-full" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>

      <label className="block text-xs">
        <span className="text-[var(--muted)]">SMS workout text (paste from your message or type fresh)</span>
        <textarea
          className="input mt-1 h-36 w-full resize-y font-mono text-sm"
          value={smsText}
          onChange={(e) => setSmsText(e.target.value)}
          placeholder={"Day 3 — Home upper body\n\n1) Push-ups 3x12\n2) Rows 3x10 each arm\n3) Plank 3x45s\n\nReply DONE when finished."}
        />
      </label>

      <div className="flex flex-wrap gap-4 text-xs">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Override schedule for this day
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={replacesLiveSession} onChange={(e) => setReplacesLiveSession(e.target.checked)} />
          In lieu of live session
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />
          Also send via SMS ({selectedIds.length} with phone)
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveOverride}
          disabled={saving || !smsText.trim()}
          className="btn-primary text-sm px-4 py-1 disabled:opacity-50"
        >
          {saving ? "Saving..." : sendSms ? "Save override & send SMS" : "Save override"}
        </button>
        <button type="button" onClick={clearOverride} disabled={saving} className="btn-ghost text-sm px-3 py-1">
          Clear override
        </button>
      </div>
    </div>
  );
}