"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ParsedExercise = {
  name: string;
  sets: number;
  reps: string;
  notes?: string;
  section?: string;
};

export default function TodaySessionPanel({
  defaultDate,
  defaultTime = "06:30",
  programSlug = "adult",
  userIds = [],
  asInstructor = false,
}: {
  defaultDate?: string;
  defaultTime?: string;
  programSlug?: string;
  userIds?: string[];
  asInstructor?: boolean;
}) {
  const router = useRouter();
  const [rawSms, setRawSms] = useState("");
  const [sessionDate, setSessionDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [scheduledTime, setScheduledTime] = useState(defaultTime);
  const [preview, setPreview] = useState<{ title: string; exercises: ParsedExercise[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleParse() {
    if (!rawSms.trim()) return;
    setMessage(null);
    const res = await fetch("/api/today/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawSms: rawSms.trim() }),
    });
    if (!res.ok) {
      setMessage("Could not parse SMS text.");
      return;
    }
    const data = await res.json();
    setPreview(data.workout);
  }

  async function handleSave() {
    if (!rawSms.trim()) return;
    setSaving(true);
    setMessage(null);
    const scheduledAt = new Date(`${sessionDate}T${scheduledTime}:00`).toISOString();
    const res = await fetch("/api/today", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionDate,
        scheduledAt,
        rawSms: rawSms.trim(),
        programSlug,
        userIds,
        replacesSchedule: true,
        createdBy: asInstructor ? "coach" : "member",
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage("Failed to save today session.");
      return;
    }
    setMessage("Today session saved — overrides the scheduled workout for that date.");
    router.refresh();
    setTimeout(() => setMessage(null), 4000);
  }

  return (
    <div className="card border-amber-500/30 bg-amber-500/5 space-y-3">
      <div>
        <h2 className="font-semibold text-sm">
          {asInstructor ? "Coach: paste SMS workout" : "Paste SMS workout for today"}
        </h2>
        <p className="text-xs text-[var(--muted)] mt-1">
          Paste the text from SMS. We parse exercises, sets/reps, and build a checkoff workout that overrides the schedule.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 text-xs">
        <label className="block">
          <span className="text-[var(--muted)]">Session date</span>
          <input type="date" className="input mt-1 w-full" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[var(--muted)]">Scheduled time</span>
          <input type="time" className="input mt-1 w-full" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
        </label>
      </div>

      <textarea
        className="input h-40 w-full resize-y font-mono text-sm"
        placeholder="Paste coach SMS workout here..."
        value={rawSms}
        onChange={(e) => setRawSms(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleParse} disabled={!rawSms.trim()} className="btn-ghost text-sm px-3 py-1">
          Preview parse
        </button>
        <button type="button" onClick={handleSave} disabled={saving || !rawSms.trim()} className="btn-primary text-sm px-4 py-1">
          {saving ? "Building..." : "Build & override schedule"}
        </button>
      </div>

      {message && <p className="text-xs text-[var(--success)]">{message}</p>}

      {preview && (
        <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
          <p className="font-semibold text-accent mb-2">{preview.title} — {preview.exercises.length} blocks</p>
          <ul className="space-y-1 max-h-48 overflow-auto">
            {preview.exercises.map((ex, i) => (
              <li key={i} className="border-b border-[var(--border)] pb-1">
                <span className="font-medium">{ex.name}</span>
                <span className="text-[var(--muted)]"> · {ex.sets} set{ex.sets !== 1 ? "s" : ""} · {ex.reps}</span>
                {ex.notes && <span className="block text-[10px] text-[var(--muted)]">{ex.notes}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}