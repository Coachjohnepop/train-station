"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CoachMemberPicker, { type CoachMemberOption } from "@/components/CoachMemberPicker";
import { DEFAULT_DEMO_MEMBER_ID } from "@/lib/demo-coach";

type ParsedExercise = {
  name: string;
  sets: number;
  reps: string;
  notes?: string;
  section?: string;
};

const DEFAULT_COACH_MEMBERS = [DEFAULT_DEMO_MEMBER_ID];

export default function TodaySessionPanel({
  defaultDate,
  defaultTime = "06:30",
  programSlug = "adult",
  defaultUserIds,
  memberOptions = [],
  asInstructor = false,
  collapsible = false,
  defaultOpen = false,
}: {
  defaultDate?: string;
  defaultTime?: string;
  programSlug?: string;
  defaultUserIds?: string[];
  memberOptions?: CoachMemberOption[];
  asInstructor?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [rawSms, setRawSms] = useState("");
  const [sessionDate, setSessionDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [scheduledTime, setScheduledTime] = useState(defaultTime);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    defaultUserIds?.length ? defaultUserIds : asInstructor ? DEFAULT_COACH_MEMBERS : [],
  );
  const [preview, setPreview] = useState<{ title: string; exercises: ParsedExercise[] } | null>(null);
  const [sendSmsAlert, setSendSmsAlert] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [open, setOpen] = useState(defaultOpen);

  function formatApiError(res: Response, body: any) {
    if (body?.detail?.fieldErrors) {
      const fields = Object.entries(body.detail.fieldErrors as Record<string, string[]>)
        .map(([k, v]) => `${k}: ${v.join(", ")}`)
        .join("; ");
      return fields || res.statusText;
    }
    if (typeof body?.detail === "string") return body.detail;
    if (body?.error) return body.error;
    return res.statusText || "Unknown error";
  }

  async function handleParse() {
    if (!rawSms.trim()) return;
    setMessage(null);
    setMessageIsError(false);
    try {
      const res = await fetch("/api/today/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawSms: rawSms.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessageIsError(true);
        setMessage(`Parse failed: ${formatApiError(res, data)}`);
        return;
      }
      setPreview(data.workout);
      setMessage(`Parsed ${data.workout?.exercises?.length || 0} blocks — review below, then Build.`);
      setMessageIsError(false);
    } catch (e: any) {
      setMessageIsError(true);
      setMessage(`Parse failed: ${e?.message || "network error"}`);
    }
  }

  async function handleSave() {
    if (!rawSms.trim()) return;
    if (asInstructor && selectedUserIds.length === 0) {
      setMessageIsError(true);
      setMessage("Select at least one member to assign this workout.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setMessageIsError(false);

    const scheduled = new Date(`${sessionDate}T${scheduledTime}:00`);
    if (Number.isNaN(scheduled.getTime())) {
      setSaving(false);
      setMessageIsError(true);
      setMessage("Invalid date or time — check session date and scheduled time.");
      return;
    }

    try {
      const res = await fetch("/api/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDate,
          scheduledAt: scheduled.toISOString(),
          rawSms: rawSms.trim(),
          programSlug,
          userIds: asInstructor ? selectedUserIds : defaultUserIds?.length ? defaultUserIds : selectedUserIds,
          replacesSchedule: true,
          createdBy: asInstructor ? "coach" : "member",
          sendSmsAlert: asInstructor ? sendSmsAlert : false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setSaving(false);
      if (!res.ok) {
        setMessageIsError(true);
        setMessage(`Save failed: ${formatApiError(res, data)}`);
        return;
      }
      const names = memberOptions
        .filter((m) => selectedUserIds.includes(m.id))
        .map((m) => m.name)
        .join(", ");
      const smsNote =
        asInstructor && sendSmsAlert && data.alerts?.sent
          ? ` · SMS sent to ${data.alerts.sent}`
          : asInstructor && sendSmsAlert
            ? " · SMS alert queued"
            : "";
      setMessage(
        `Built "${data.session?.title || "workout"}" with ${data.parsed?.exercises?.length || 0} blocks${names ? ` for ${names}` : ""}${smsNote}.`,
      );
      setMessageIsError(false);
      router.refresh();
      setTimeout(() => setMessage(null), 5000);
    } catch (e: any) {
      setSaving(false);
      setMessageIsError(true);
      setMessage(`Save failed: ${e?.message || "network error"}`);
    }
  }

  const panelTitle = asInstructor ? "Paste SMS workout" : "Paste SMS workout for today";

  const inner = (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted)]">
        Parsed by our built-in SMS rules (exercises, sets/reps, warm-up blocks) — not a live AI call. Only members you select below get this workout on Go to Today.
      </p>

      {asInstructor && memberOptions.length > 0 && (
        <CoachMemberPicker
          members={memberOptions}
          selectedIds={selectedUserIds}
          onChange={setSelectedUserIds}
        />
      )}

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

      {asInstructor && (
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={sendSmsAlert} onChange={(e) => setSendSmsAlert(e.target.checked)} />
          Send SMS alert to selected members with link to Go to Today
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleParse} disabled={!rawSms.trim()} className="btn-ghost text-sm px-3 py-1">
          Preview parse
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !rawSms.trim() || (asInstructor && selectedUserIds.length === 0)}
          className="btn-primary text-sm px-4 py-1"
        >
          {saving ? "Building..." : "Build & override schedule"}
        </button>
      </div>

      {message && (
        <p className={`text-xs ${messageIsError ? "text-red-400" : "text-[var(--success)]"}`}>{message}</p>
      )}

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

  if (collapsible) {
    return (
      <details
        className="group card border-amber-500/30 bg-amber-500/5"
        open={open}
        onToggle={(e) => setOpen(e.currentTarget.open)}
      >
        <summary className="flex items-center gap-2 cursor-pointer list-none font-semibold text-sm py-1">
          <span className="text-accent group-open:rotate-90 transition-transform text-xs">▶</span>
          {panelTitle}
        </summary>
        <div className="mt-3 pt-3 border-t border-amber-500/20">{inner}</div>
      </details>
    );
  }

  return (
    <div className="card border-amber-500/30 bg-amber-500/5 space-y-3">
      <h2 className="font-semibold text-sm">{panelTitle}</h2>
      {inner}
    </div>
  );
}