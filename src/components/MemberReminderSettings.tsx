"use client";

import { useEffect, useState } from "react";

type ReminderSettings = {
  phone: string | null;
  dailyReminderTime: string | null;
};

export default function MemberReminderSettings() {
  const [settings, setSettings] = useState<ReminderSettings>({ phone: null, dailyReminderTime: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true); // collapsible like home equipment

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/member/reminder-settings");
      const json = await res.json();
      setSettings({
        phone: json.phone || "",
        dailyReminderTime: json.dailyReminderTime || "",
      });
    } catch (e) {
      setMessage("Failed to load settings");
    }
    setLoading(false);
  }

  async function save(newSettings: ReminderSettings) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/member/reminder-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        const json = await res.json();
        setSettings({
          phone: json.phone || "",
          dailyReminderTime: json.dailyReminderTime || "",
        });
        setMessage("Saved!");
        setTimeout(() => setMessage(null), 1500);
      } else {
        setMessage("Failed to save");
      }
    } catch {
      setMessage("Failed to save");
    }
    setSaving(false);
  }

  function handleChange(field: keyof ReminderSettings, value: string) {
    const updated = { ...settings, [field]: value };
    setSettings(updated);
    // Debounce save a bit
    setTimeout(() => {
      save(updated);
    }, 400);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div className="card text-xs p-3 bg-[var(--surface-2)]">Loading SMS settings...</div>;
  }

  return (
    <div className="card text-xs p-3 bg-[var(--surface-2)] space-y-2">
      <div
        className="font-medium flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>
          SMS Reminders &amp; Contact
          {settings.dailyReminderTime && (
            <span className="ml-1 text-[var(--muted)]">
              — {settings.dailyReminderTime}
              {settings.phone && " • phone set"}
            </span>
          )}
        </span>
        <span className="text-[var(--muted)]">{isOpen ? "−" : "+"}</span>
        {message && <span className="text-[var(--success)] text-[10px]">{message}</span>}
      </div>

      {isOpen && (
        <>
          <div>
            <label className="block text-[10px] text-[var(--muted)] mb-0.5">Phone number for SMS</label>
            <input
              type="tel"
              value={settings.phone || ""}
              onChange={(e) => handleChange("phone", e.target.value)}
              disabled={saving}
              placeholder="(555) 123-4567"
              className="input text-sm w-full"
            />
          </div>

          <div>
            <label className="block text-[10px] text-[var(--muted)] mb-0.5">Daily reminder time (24h)</label>
            <input
              type="time"
              value={settings.dailyReminderTime || ""}
              onChange={(e) => handleChange("dailyReminderTime", e.target.value)}
              disabled={saving}
              className="input text-sm w-full"
            />
            <div className="text-[10px] text-[var(--muted)] mt-0.5">
              Reminders will include a direct link to that day&apos;s workout.
            </div>
          </div>

          <div className="text-[10px] text-[var(--muted)]">
            Instructors can also send broadcast messages. This is low-security demo SMS.
          </div>

          {/* Calendly note per client feedback (booking vs reminders) */}
          <div className="text-[10px] text-[var(--muted)] pt-1 border-t border-[var(--border)]/60">
            To book a live session with your coach, use the Calendly link (in “Live sessions” or ask your coach for the direct scheduling link). These SMS settings are for daily workout reminders only.
          </div>

          {/* Simple reply / contact coach */}
          <div className="pt-2 border-t border-[var(--border)] mt-2">
            <label className="block text-[10px] text-[var(--muted)] mb-0.5">Quick message to your coach</label>
            <textarea
              id="coach-message"
              className="input text-sm w-full h-16"
              placeholder="e.g. Just crushed today's session — new PR on squats! Feeling great, thanks for the programming."
              disabled={saving}
            />
            <button
              type="button"
              className="btn-ghost text-xs mt-1"
              disabled={saving}
              onClick={async () => {
                const ta = document.getElementById("coach-message") as HTMLTextAreaElement;
                if (!ta || !ta.value.trim()) return;
                setSaving(true);
                setMessage(null);
                try {
                  const res = await fetch("/api/member/send-coach-message", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: ta.value.trim() }),
                  });
                  if (res.ok) {
                    setMessage("Message sent to coach (simulated inbound)");
                    ta.value = "";
                    setTimeout(() => setMessage(null), 2000);
                  } else {
                    setMessage("Failed to send");
                  }
                } catch {
                  setMessage("Failed to send");
                }
                setSaving(false);
              }}
            >
              Send message (simulates reply to SMS)
            </button>

            {/* Quick SMS task reports for new broadcast categories */}
            <div className="mt-3 pt-2 border-t border-[var(--border)]">
              <div className="text-[10px] text-[var(--muted)] mb-1">Quick reports (simulates SMS reply to broadcast):</div>
              <div className="flex flex-wrap gap-1">
                <button onClick={async () => {
                  setSaving(true);
                  await fetch("/api/member/send-coach-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "cardio done 25min fasted" }) });
                  setMessage("Fasted cardio reported via SMS sim");
                  setTimeout(() => setMessage(null), 2000);
                  setSaving(false);
                }} className="text-[10px] btn-ghost px-1 py-0">Report fasted cardio</button>

                <button onClick={async () => {
                  setSaving(true);
                  await fetch("/api/member/send-coach-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "slept 7.5 hours" }) });
                  setMessage("Sleep hours reported via SMS sim");
                  setTimeout(() => setMessage(null), 2000);
                  setSaving(false);
                }} className="text-[10px] btn-ghost px-1 py-0">Report sleep</button>

                <button onClick={async () => {
                  setSaving(true);
                  await fetch("/api/member/send-coach-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "done" }) });
                  setMessage("Exercise/task 'done' reported via SMS sim");
                  setTimeout(() => setMessage(null), 2000);
                  setSaving(false);
                }} className="text-[10px] btn-ghost px-1 py-0">Report 'done' (pushups etc)</button>
              </div>
              <div className="text-[9px] text-[var(--muted)] mt-1">These simulate student replying to SMS broadcasts for cardio, sleep, quick exercises. (Eating coming soon.)</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
