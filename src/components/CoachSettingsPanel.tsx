"use client";

import { useEffect, useState } from "react";
import type { CoachAlertEvent, CoachAlertPrefs } from "@/lib/alert-channels";
import type { WarmupBlockTemplate } from "@/lib/warmup-template";
import type { RampWeekTemplate } from "@/lib/member-ramp-template";

type CoachSettings = {
  coachPhone: string | null;
  coachEmail: string | null;
  messagingEnabled: boolean;
  alertPrefs: CoachAlertPrefs;
  warmupBlocks: WarmupBlockTemplate[];
  rampTemplate: RampWeekTemplate[];
  updatedAt: string;
};

const EVENT_LABELS: Record<CoachAlertEvent, string> = {
  newMember: "New member finished onboarding",
  warmupStarted: "Member started warm-ups",
  intakeScheduled: "Member ready for intake sign-off",
};

export default function CoachSettingsPanel() {
  const [settings, setSettings] = useState<CoachSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/coach-settings");
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSettings(data.settings);
    else setMessage(data.error || "Could not load settings.");
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/coach-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coachPhone: settings.coachPhone,
        coachEmail: settings.coachEmail,
        messagingEnabled: settings.messagingEnabled,
        alertPrefs: settings.alertPrefs,
        warmupBlocks: settings.warmupBlocks,
        rampTemplate: settings.rampTemplate,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setSettings(data.settings);
      setMessage("Settings saved.");
    } else {
      setMessage(data.error || "Save failed.");
    }
    setSaving(false);
  }

  function toggleAlert(event: CoachAlertEvent, channel: "inApp" | "sms" | "email") {
    if (!settings) return;
    setSettings({
      ...settings,
      alertPrefs: {
        ...settings.alertPrefs,
        [event]: {
          ...settings.alertPrefs[event],
          [channel]: !settings.alertPrefs[event][channel],
        },
      },
    });
  }

  function updateWarmup(idx: number, patch: Partial<WarmupBlockTemplate>) {
    if (!settings) return;
    const blocks = [...settings.warmupBlocks];
    blocks[idx] = { ...blocks[idx], ...patch };
    setSettings({ ...settings, warmupBlocks: blocks });
  }

  function updateRampDay(
    weekIdx: number,
    dayIdx: number,
    patch: Partial<{ theme: string; notes: string | null }>,
  ) {
    if (!settings) return;
    const ramp = settings.rampTemplate.map((w, wi) =>
      wi !== weekIdx
        ? w
        : {
            ...w,
            days: w.days.map((d, di) => (di !== dayIdx ? d : { ...d, ...patch })),
          },
    );
    setSettings({ ...settings, rampTemplate: ramp });
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading coach settings…</p>;
  if (!settings) return <p className="text-sm text-rose-300">{message || "No settings."}</p>;

  return (
    <div className="space-y-8">
      <section
        className={`card space-y-4 p-5 ${
          settings.messagingEnabled ? "" : "border-amber-500/40 bg-amber-500/5"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Outbound messaging</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Master switch for all Resend email and carrier SMS — leads, welcome messages, password
              resets, hub broadcasts, and coach alerts. In-app chat is not affected.
            </p>
          </div>
          <label className="flex items-center gap-3 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={settings.messagingEnabled}
              onChange={(e) =>
                setSettings({ ...settings, messagingEnabled: e.target.checked })
              }
            />
            {settings.messagingEnabled ? "Messaging on" : "Messaging paused"}
          </label>
        </div>
        {!settings.messagingEnabled && (
          <p className="text-sm text-amber-200">
            Paused — no outbound email or SMS will send until you turn this back on and save.
          </p>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold">Contact for alerts</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Used for SMS and email coach notifications (global defaults).
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Coach email</span>
            <input
              className="input mt-1 w-full"
              value={settings.coachEmail || ""}
              onChange={(e) => setSettings({ ...settings, coachEmail: e.target.value || null })}
              placeholder="jeremy@thetrainstation.co"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Coach SMS phone</span>
            <input
              className="input mt-1 w-full"
              value={settings.coachPhone || ""}
              onChange={(e) => setSettings({ ...settings, coachPhone: e.target.value || null })}
              placeholder="+1 555 123 4567"
            />
          </label>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold">Global alert preferences</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Per-student overrides are available on the Members page.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                <th className="pb-2 pr-4">Event</th>
                <th className="pb-2 px-2">In-app</th>
                <th className="pb-2 px-2">SMS</th>
                <th className="pb-2 px-2">Email</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(EVENT_LABELS) as CoachAlertEvent[]).map((event) => (
                <tr key={event} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-4">{EVENT_LABELS[event]}</td>
                  {(["inApp", "sms", "email"] as const).map((ch) => (
                    <td key={ch} className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={settings.alertPrefs[event][ch]}
                        onChange={() => toggleAlert(event, ch)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold">Warm-up template</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            New members see these before intake sign-off — with set checkoffs.
          </p>
        </div>
        <div className="space-y-3">
          {settings.warmupBlocks.map((block, idx) => (
            <div
              key={block.id}
              className="grid gap-2 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-4"
            >
              <input
                className="input sm:col-span-2"
                value={block.name}
                onChange={(e) => updateWarmup(idx, { name: e.target.value })}
              />
              <input
                className="input"
                type="number"
                min={1}
                max={10}
                value={block.setCount}
                onChange={(e) =>
                  updateWarmup(idx, { setCount: Math.max(1, Number(e.target.value) || 1) })
                }
              />
              <input
                className="input"
                value={block.reps || ""}
                placeholder="Reps / time"
                onChange={(e) => updateWarmup(idx, { reps: e.target.value || null })}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold">2-week ramp template</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Auto-starts when a member finishes onboarding. Edit themes per day.
          </p>
        </div>
        <div className="space-y-4">
          {settings.rampTemplate.map((week, weekIdx) => (
            <div key={week.weekNumber}>
              <p className="text-sm font-semibold text-accent">{week.label}</p>
              <div className="mt-2 space-y-2">
                {week.days.map((day, dayIdx) => (
                  <div
                    key={`${week.weekNumber}-${day.dayNumber}`}
                    className="grid gap-2 sm:grid-cols-[4rem_1fr_1fr]"
                  >
                    <span className="text-xs text-[var(--muted)] pt-2">{day.label}</span>
                    <input
                      className="input"
                      value={day.theme}
                      onChange={(e) => updateRampDay(weekIdx, dayIdx, { theme: e.target.value })}
                    />
                    <input
                      className="input"
                      value={day.notes || ""}
                      placeholder="Coach notes"
                      onChange={(e) =>
                        updateRampDay(weekIdx, dayIdx, { notes: e.target.value || null })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
        {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
      </div>
    </div>
  );
}