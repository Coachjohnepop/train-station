"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TimeScrollPicker from "@/components/TimeScrollPicker";
import PhoneInput from "@/components/PhoneInput";
import { formatPhoneInputValue } from "@/lib/sms-phone";

type ReminderSettings = {
  phone: string;
  dailyReminderTime: string;
};

export default function MemberReminderSettings() {
  const [settings, setSettings] = useState<ReminderSettings>({ phone: "", dailyReminderTime: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSettingsRef = useRef(settings);

  useEffect(() => {
    latestSettingsRef.current = settings;
  }, [settings]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/member/reminder-settings");
      const json = await res.json();
      setSettings({
        phone: formatPhoneInputValue(json.phone || ""),
        dailyReminderTime: json.dailyReminderTime || "",
      });
    } catch {
      setMessage("Failed to load settings");
    }
    setLoading(false);
  }, []);

  const save = useCallback(async (nextSettings: ReminderSettings) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/member/reminder-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
      if (res.ok) {
        const json = await res.json();
        // Only apply server response if user hasn't typed ahead of this save.
        const current = latestSettingsRef.current;
        if (current.phone === nextSettings.phone && current.dailyReminderTime === nextSettings.dailyReminderTime) {
          setSettings({
            phone: formatPhoneInputValue(json.phone || ""),
            dailyReminderTime: json.dailyReminderTime || "",
          });
        }
        setMessage("Saved!");
        setTimeout(() => setMessage(null), 1500);
      } else {
        setMessage("Failed to save");
      }
    } catch {
      setMessage("Failed to save");
    }
    setSaving(false);
  }, []);

  const queueSave = useCallback(
    (nextSettings: ReminderSettings) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        save(nextSettings);
      }, 600);
    },
    [save],
  );

  function handleChange(field: keyof ReminderSettings, value: string) {
    const updated = { ...latestSettingsRef.current, [field]: value };
    setSettings(updated);
    queueSave(updated);
  }

  useEffect(() => {
    load();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [load]);

  if (loading) {
    return <div className="card text-xs p-3 bg-[var(--bg)] border border-[var(--accent)]/40">Loading alert settings...</div>;
  }

  return (
    <div className="card text-xs p-3 bg-[var(--bg)] border border-[var(--accent)]/40 space-y-2">
      <div
        className="font-medium flex items-center gap-2 cursor-pointer select-none bg-white text-[#7c3aed] px-2 py-1 rounded-md"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`text-xs text-[#7c3aed] transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
        <span className="flex-1">
          Coach alerts &amp; messages
          {settings.dailyReminderTime && (
            <span className="ml-1 text-[#7c3aed]/70">
              — reminder {settings.dailyReminderTime}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 text-[#7c3aed]">
          {saving && <span className="text-[10px] text-[var(--muted)]">Saving…</span>}
          {message && <span className="text-[var(--success)] text-[10px]">{message}</span>}
        </span>
      </div>

      {isOpen && (
        <>
          <p className="text-[10px] text-[var(--muted)]">
            Alerts go to your account email and{" "}
            <a href="/member/chat" className="text-accent hover:underline">
              in-app Messages
            </a>
            . Your coach never sees your phone number.
          </p>

          <div>
            <label className="block text-[10px] text-[var(--muted)] mb-0.5">
              Mobile (optional — only if we add carrier texts later)
            </label>
            <PhoneInput
              value={settings.phone}
              onChange={(phone) => handleChange("phone", phone)}
              onBlur={() => {
                if (saveTimerRef.current) {
                  clearTimeout(saveTimerRef.current);
                  save(latestSettingsRef.current);
                }
              }}
              placeholder="(916.284.1994)"
              className="input text-sm w-full"
            />
          </div>

          <div>
            <label className="block text-[10px] text-[var(--muted)] mb-1.5">Daily reminder time</label>
            <TimeScrollPicker
              value={settings.dailyReminderTime || "07:30"}
              onChange={(dailyReminderTime) => {
                handleChange("dailyReminderTime", dailyReminderTime);
              }}
            />
            <div className="text-[10px] text-[var(--muted)] mt-1.5">
              We&apos;ll email you at reminder time with a link to that day&apos;s workout (no paid text number needed).
            </div>
          </div>

          <div className="text-[10px] text-[var(--muted)] pt-1 border-t border-[var(--border)]/60">
            Book onboarding or live sessions via Calendly on the Book Call page.
          </div>

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
                    setMessage("Sent to your coach in the hub");
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
              Send to coach (in-app hub)
            </button>

            <div className="mt-3 pt-2 border-t border-[var(--border)]">
              <div className="text-[10px] text-[var(--muted)] mb-1">Quick reports (coach sees these in SMS Hub / Messages):</div>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={async () => {
                    setSaving(true);
                    await fetch("/api/member/send-coach-message", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ message: "cardio done 25min fasted" }),
                    });
                    setMessage("Fasted cardio reported via SMS sim");
                    setTimeout(() => setMessage(null), 2000);
                    setSaving(false);
                  }}
                  className="text-[10px] btn-ghost px-1 py-0"
                >
                  Report fasted cardio
                </button>

                <button
                  onClick={async () => {
                    setSaving(true);
                    await fetch("/api/member/send-coach-message", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ message: "slept 7.5 hours" }),
                    });
                    setMessage("Sleep hours reported via SMS sim");
                    setTimeout(() => setMessage(null), 2000);
                    setSaving(false);
                  }}
                  className="text-[10px] btn-ghost px-1 py-0"
                >
                  Report sleep
                </button>

                <button
                  onClick={async () => {
                    setSaving(true);
                    await fetch("/api/member/send-coach-message", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ message: "done" }),
                    });
                    setMessage("Exercise/task 'done' reported via SMS sim");
                    setTimeout(() => setMessage(null), 2000);
                    setSaving(false);
                  }}
                  className="text-[10px] btn-ghost px-1 py-0"
                >
                  Report &apos;done&apos; (pushups etc)
                </button>
              </div>
              <div className="text-[9px] text-[var(--muted)] mt-1">
                These simulate student replying to SMS broadcasts for cardio, sleep, quick exercises. (Eating coming soon.)
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}