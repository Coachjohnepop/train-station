"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import AdminMemberEquipmentModal from "@/components/AdminMemberEquipmentModal";
import AdminMemberMeasurementsModal from "@/components/AdminMemberMeasurementsModal";
import PhoneInput from "@/components/PhoneInput";
import TimeScrollPicker from "@/components/TimeScrollPicker";
import type { MemberProfile } from "@/lib/member-profiles-types";
import {
  ONBOARD_GENDERS,
  PRIMARY_GOALS,
  WEIGHT_LOSS_TIMELINES,
  WORKOUT_SCHEDULES,
  onboardGenderLabel,
  primaryGoalLabel,
  workoutScheduleLabel,
} from "@/lib/onboard-path";
import { signupPlanLabel } from "@/lib/signup-plans";

type CardPayload = {
  userId: string;
  email: string;
  name: string;
  createdAt: string;
  planLabel: string;
  coachingMode: string;
  profile: MemberProfile;
};

type FormState = {
  name: string;
  phone: string;
  city: string;
  state: string;
  gender: string;
  weightLbs: string;
  startWeightLbs: string;
  goalWeightLbs: string;
  primaryGoal: string;
  workoutSchedule: string;
  weightLossGoal: string;
  weightLossTimeline: string;
  dailyReminderTime: string;
  notes: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    phone: "",
    city: "",
    state: "",
    gender: "",
    weightLbs: "",
    startWeightLbs: "",
    goalWeightLbs: "",
    primaryGoal: "",
    workoutSchedule: "",
    weightLossGoal: "",
    weightLossTimeline: "",
    dailyReminderTime: "",
    notes: "",
  };
}

function formFromCard(card: CardPayload): FormState {
  const p = card.profile;
  return {
    name: card.name || "",
    phone: p.phone || "",
    city: p.city || "",
    state: p.state || "",
    gender: p.gender || "",
    weightLbs: p.weightLbs || "",
    startWeightLbs: p.startWeightLbs || "",
    goalWeightLbs: p.goalWeightLbs || "",
    primaryGoal: p.primaryGoal || "",
    workoutSchedule: p.workoutSchedule || "",
    weightLossGoal: p.weightLossGoal || "",
    weightLossTimeline: p.weightLossTimeline || "",
    dailyReminderTime: p.dailyReminderTime || "",
    notes: p.notes || "",
  };
}

function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass = "input w-full text-sm";

export default function AdminMemberCard({ userId }: { userId: string }) {
  const [card, setCard] = useState<CardPayload | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [intakeSigning, setIntakeSigning] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/members/${encodeURIComponent(userId)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load member card.");
      setCard(null);
    } else {
      const next = data as CardPayload;
      setCard(next);
      setForm(formFromCard(next));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!card) return false;
    return JSON.stringify(form) !== JSON.stringify(formFromCard(card));
  }, [card, form]);

  function patchForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSavedAt(null);
  }

  const saveCard = useCallback(async () => {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/members/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        gender: form.gender || null,
        weightLbs: form.weightLbs.trim() || null,
        startWeightLbs: form.startWeightLbs.trim() || null,
        goalWeightLbs: form.goalWeightLbs.trim() || null,
        primaryGoal: form.primaryGoal || null,
        workoutSchedule: form.workoutSchedule || null,
        weightLossGoal: form.weightLossGoal.trim() || null,
        weightLossTimeline: form.weightLossTimeline || null,
        dailyReminderTime: form.dailyReminderTime || null,
        notes: form.notes.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not save member card.");
    } else {
      const next = data as CardPayload;
      setCard(next);
      setForm(formFromCard(next));
      setSavedAt(new Date().toISOString());
    }
    setSaving(false);
  }, [form, userId]);

  async function signOffIntake() {
    setIntakeSigning(true);
    setError("");
    if (dirty) await saveCard();
    const res = await fetch(`/api/admin/members/${encodeURIComponent(userId)}/intake`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Intake sign-off failed.");
    } else {
      await load();
    }
    setIntakeSigning(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !saving) void saveCard();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, saving, saveCard]);

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading member card…</p>;
  }

  if (!card) {
    return (
      <div className="space-y-3">
        <Link href="/admin/members" className="text-sm text-accent hover:underline">
          ← Members
        </Link>
        <p className="text-sm text-amber-400">{error || "Member not found."}</p>
      </div>
    );
  }

  const profile = card.profile;
  const intakeDone = Boolean(profile.coachIntakeCompleteAt);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/members" className="text-sm text-accent hover:underline">
          ← Members
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/chat?member=${encodeURIComponent(userId)}`}
            className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-accent/30 text-accent"
          >
            Message
          </Link>
          <button
            type="button"
            onClick={() => setEquipmentOpen(true)}
            className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-sky-500/30 text-sky-300"
          >
            Equipment
          </button>
          <button
            type="button"
            onClick={() => setMeasurementsOpen(true)}
            className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-fuchsia-500/30 text-fuchsia-300"
          >
            Measurements
          </button>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[28px] border-2 border-[color-mix(in_srgb,var(--ramp-gold)_42%,var(--border))] bg-[var(--surface)] shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
        <div className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l-2 border-t-2 border-[color-mix(in_srgb,var(--ramp-gold)_70%,transparent)]" />
        <div className="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r-2 border-t-2 border-[color-mix(in_srgb,var(--ramp-gold)_70%,transparent)]" />
        <div className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 border-[color-mix(in_srgb,var(--ramp-gold)_70%,transparent)]" />
        <div className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 border-b-2 border-r-2 border-[color-mix(in_srgb,var(--ramp-gold)_70%,transparent)]" />

        <header className="flex flex-wrap items-center gap-4 border-b border-[var(--border)] bg-[var(--surface-2)] px-6 py-5">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-[color-mix(in_srgb,var(--ramp-gold)_55%,transparent)] bg-[var(--bg)] text-xl font-bold tracking-wide text-[var(--ramp-gold-light)]"
            aria-hidden
          >
            {initials(form.name || card.name, card.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--ramp-gold-light)]">
              Member card
            </p>
            <input
              value={form.name}
              onChange={(e) => patchForm("name", e.target.value)}
              className="mt-1 w-full bg-transparent text-2xl font-semibold tracking-tight text-[var(--text)] outline-none"
              placeholder="Character name"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              {card.planLabel} · {card.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {profile.onboardingComplete ? "Onboarded" : "Onboarding"}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                intakeDone
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-sky-500/15 text-sky-300"
              }`}
            >
              {intakeDone ? "Intake done" : "15-min intro"}
            </span>
            <span className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {profile.approvalStatus}
            </span>
            <span className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {profile.paymentStatus === "none" ? "free" : profile.paymentStatus}
            </span>
          </div>
        </header>

        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="space-y-5">
            <div>
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--ramp-gold-light)]">
                Contact
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Phone — capture on the intro call">
                  <PhoneInput
                    value={form.phone}
                    onChange={(phone) => patchForm("phone", phone)}
                    className={inputClass}
                    placeholder="916.284.1994"
                  />
                </Field>
                <Field label="Daily text time">
                  {form.dailyReminderTime ? (
                    <TimeScrollPicker
                      className="mt-0"
                      value={form.dailyReminderTime}
                      onChange={(value) => patchForm("dailyReminderTime", value)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost w-full text-left text-sm px-3 py-2 ring-1 ring-[var(--border)]"
                      onClick={() => patchForm("dailyReminderTime", "07:30")}
                    >
                      Set reminder time
                    </button>
                  )}
                </Field>
                <Field label="City">
                  <input
                    className={inputClass}
                    value={form.city}
                    onChange={(e) => patchForm("city", e.target.value)}
                    placeholder="Sacramento"
                  />
                </Field>
                <Field label="State">
                  <input
                    className={inputClass}
                    value={form.state}
                    onChange={(e) => patchForm("state", e.target.value)}
                    placeholder="CA"
                  />
                </Field>
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--ramp-gold-light)]">
                Stats
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Man / woman">
                  <select
                    className={inputClass}
                    value={form.gender}
                    onChange={(e) => patchForm("gender", e.target.value)}
                  >
                    <option value="">Not set</option>
                    {ONBOARD_GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {onboardGenderLabel(g)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Workout schedule">
                  <select
                    className={inputClass}
                    value={form.workoutSchedule}
                    onChange={(e) => patchForm("workoutSchedule", e.target.value)}
                  >
                    <option value="">Not set</option>
                    {WORKOUT_SCHEDULES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Current weight (lb)">
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={form.weightLbs}
                    onChange={(e) => patchForm("weightLbs", e.target.value)}
                    placeholder="185"
                  />
                </Field>
                <Field label="Start weight (lb)">
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={form.startWeightLbs}
                    onChange={(e) => patchForm("startWeightLbs", e.target.value)}
                    placeholder="195"
                  />
                </Field>
                <Field label="Goal weight (lb)">
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={form.goalWeightLbs}
                    onChange={(e) => patchForm("goalWeightLbs", e.target.value)}
                    placeholder="170"
                  />
                </Field>
                <Field label="Class">
                  <input
                    className={`${inputClass} text-[var(--muted)]`}
                    value={signupPlanLabel(profile.plan)}
                    readOnly
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--ramp-gold-light)]">
                Goals
              </h2>
              <div className="grid gap-3">
                <Field label="Primary goal">
                  <select
                    className={inputClass}
                    value={form.primaryGoal}
                    onChange={(e) => patchForm("primaryGoal", e.target.value)}
                  >
                    <option value="">Not set</option>
                    {PRIMARY_GOALS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Fat-loss target">
                  <input
                    className={inputClass}
                    value={form.weightLossGoal}
                    onChange={(e) => patchForm("weightLossGoal", e.target.value)}
                    placeholder="Drop 20 lbs for the wedding"
                  />
                </Field>
                <Field label="Timeline">
                  <select
                    className={inputClass}
                    value={form.weightLossTimeline}
                    onChange={(e) => patchForm("weightLossTimeline", e.target.value)}
                  >
                    <option value="">Not set</option>
                    {WEIGHT_LOSS_TIMELINES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--ramp-gold-light)]">
                Coach notes
              </h2>
              <textarea
                className="input min-h-[220px] w-full resize-y text-sm leading-relaxed"
                value={form.notes}
                onChange={(e) => patchForm("notes", e.target.value)}
                placeholder="Free-form notes from the 15-minute intro — injuries, family, schedule constraints, what they actually want."
              />
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-6 py-4">
          <p className="text-[11px] text-[var(--muted)]">
            Signed up {formatWhen(card.createdAt)}
            {profile.introBookedAt ? ` · Intro booked ${formatWhen(profile.introBookedAt)}` : ""}
            {intakeDone
              ? ` · Intake ${formatWhen(profile.coachIntakeCompleteAt)}`
              : " · Fill this card during the call, then sign off intake."}
            {primaryGoalLabel(form.primaryGoal) || workoutScheduleLabel(form.workoutSchedule)
              ? ` · ${[primaryGoalLabel(form.primaryGoal), workoutScheduleLabel(form.workoutSchedule)].filter(Boolean).join(" · ")}`
              : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {savedAt ? (
              <span className="text-[11px] font-semibold text-emerald-300">Saved</span>
            ) : dirty ? (
              <span className="text-[11px] text-amber-300">Unsaved</span>
            ) : null}
            <button
              type="button"
              onClick={() => void saveCard()}
              disabled={saving || !dirty}
              className="btn-primary text-xs px-4 py-2"
            >
              {saving ? "Saving…" : "Save card"}
            </button>
            {!intakeDone ? (
              <button
                type="button"
                onClick={() => void signOffIntake()}
                disabled={intakeSigning}
                className="btn-ghost text-xs px-4 py-2 ring-1 ring-sky-500/40 text-sky-300"
              >
                {intakeSigning ? "…" : "Sign off intake"}
              </button>
            ) : null}
          </div>
        </footer>
      </section>

      <p className="text-[11px] text-[var(--muted)]">
        Phone lives on this card now — capture it during the 15-minute intro, not at signup.
      </p>

      {error ? <p className="text-sm text-amber-400">{error}</p> : null}

      {equipmentOpen ? (
        <AdminMemberEquipmentModal
          userId={userId}
          memberName={form.name || card.name}
          onClose={() => setEquipmentOpen(false)}
        />
      ) : null}
      {measurementsOpen ? (
        <AdminMemberMeasurementsModal
          userId={userId}
          memberName={form.name || card.name}
          onClose={() => setMeasurementsOpen(false)}
        />
      ) : null}
    </div>
  );
}
