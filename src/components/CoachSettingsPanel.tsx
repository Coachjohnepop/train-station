"use client";

import { useEffect, useState } from "react";
import type { CoachAlertEvent, CoachAlertPrefs } from "@/lib/alert-channels";
import type { WarmupBlockTemplate } from "@/lib/warmup-template";
import type { RampWeekTemplate } from "@/lib/member-ramp-template";
import {
  GAMIFICATION_EVENT_LABELS,
  GAMIFICATION_EVENT_TYPES,
  type GamificationEventType,
  type GamificationPointsMap,
} from "@/lib/gamification-types";
import { PROGRAM_START_WEEKDAYS } from "@/lib/program-start-settings";

type CoachSettings = {
  coachPhone: string | null;
  coachEmail: string | null;
  messagingEnabled: boolean;
  autoPromptIntroBooking: boolean;
  autoPromptFollowUpBooking: boolean;
  alertPrefs: CoachAlertPrefs;
  warmupBlocks: WarmupBlockTemplate[];
  rampTemplate: RampWeekTemplate[];
  gamificationPoints: GamificationPointsMap;
  programStartMaxOffsetDays: number;
  programStartRecommendWeekday: number | null;
  programBlockDays: number;
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
        autoPromptIntroBooking: settings.autoPromptIntroBooking,
        autoPromptFollowUpBooking: settings.autoPromptFollowUpBooking,
        alertPrefs: settings.alertPrefs,
        warmupBlocks: settings.warmupBlocks,
        rampTemplate: settings.rampTemplate,
        gamificationPoints: settings.gamificationPoints,
        programStartMaxOffsetDays: settings.programStartMaxOffsetDays,
        programStartRecommendWeekday: settings.programStartRecommendWeekday,
        programBlockDays: settings.programBlockDays,
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

  function updateGamificationPoint(type: GamificationEventType, value: number) {
    if (!settings) return;
    setSettings({
      ...settings,
      gamificationPoints: {
        ...settings.gamificationPoints,
        [type]: Math.max(0, Math.min(10_000, Math.round(value) || 0)),
      },
    });
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
          <h2 className="text-lg font-semibold">Book-a-call prompts on Today</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Off by default — members won&apos;t see booking cards on Today unless you turn these on.
            They can still use the Book Call tab. For follow-ups, use Request meeting on a member
            profile, then enable the follow-up prompt below.
          </p>
        </div>
        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.autoPromptIntroBooking}
              onChange={(e) =>
                setSettings({ ...settings, autoPromptIntroBooking: e.target.checked })
              }
            />
            <span>
              <span className="font-medium">Intro booking card</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                Show &ldquo;Book your 15-minute intro&rdquo; on Today for new members before intake
                sign-off.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.autoPromptFollowUpBooking}
              onChange={(e) =>
                setSettings({ ...settings, autoPromptFollowUpBooking: e.target.checked })
              }
            />
            <span>
              <span className="font-medium">Follow-up booking card</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                After you click Request meeting on Members, show &ldquo;Book follow-up call&rdquo; on
                that member&apos;s Today page.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold">New member program start</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            After payment, members pick when Day 1 begins. Defaults encourage Monday for weekend
            trainers.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Max days to schedule ahead</span>
            <input
              className="input mt-1 w-full"
              type="number"
              min={0}
              max={14}
              value={settings.programStartMaxOffsetDays}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  programStartMaxOffsetDays: Math.max(
                    0,
                    Math.min(14, Number(e.target.value) || 0),
                  ),
                })
              }
            />
            <span className="mt-1 block text-[10px] text-[var(--muted)]">
              0 = today only · 6 = through six days out (current default)
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Paid block length (days)</span>
            <input
              className="input mt-1 w-full"
              type="number"
              min={7}
              max={56}
              value={settings.programBlockDays}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  programBlockDays: Math.max(7, Math.min(56, Number(e.target.value) || 28)),
                })
              }
            />
          </label>
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.programStartRecommendWeekday != null}
            onChange={(e) =>
              setSettings({
                ...settings,
                programStartRecommendWeekday: e.target.checked
                  ? settings.programStartRecommendWeekday ?? 1
                  : null,
              })
            }
          />
          <span>
            <span className="font-medium">Recommend a start weekday</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Pre-selects that day in onboarding (e.g. Monday for members who train weekends).
            </span>
          </span>
        </label>
        {settings.programStartRecommendWeekday != null && (
          <label className="block text-sm max-w-xs">
            <span className="text-[var(--muted)]">Recommended weekday</span>
            <select
              className="input mt-1 w-full"
              value={settings.programStartRecommendWeekday}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  programStartRecommendWeekday: Number(e.target.value),
                })
              }
            >
              {PROGRAM_START_WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
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
          <h2 className="text-lg font-semibold">Gamification points</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Point values members earn for each accomplishment on Today. Changes apply to new awards
            only — past ledger entries keep their original values.
          </p>
        </div>
        <div className="space-y-2">
          {GAMIFICATION_EVENT_TYPES.map((type) => (
            <label
              key={type}
              className="grid gap-2 rounded-lg border border-[var(--border)] px-3 py-2 sm:grid-cols-[1fr_7rem]"
            >
              <span className="text-sm">
                <span className="font-medium">{GAMIFICATION_EVENT_LABELS[type]}</span>
                <span className="mt-0.5 block text-[10px] text-[var(--muted)]">{type}</span>
              </span>
              <input
                className="input text-right tabular-nums"
                type="number"
                min={0}
                max={10000}
                value={settings.gamificationPoints[type]}
                onChange={(e) => updateGamificationPoint(type, Number(e.target.value))}
              />
            </label>
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