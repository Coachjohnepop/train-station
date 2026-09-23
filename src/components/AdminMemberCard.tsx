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
import { ordinalPlace } from "@/lib/business-upgrade";
import { signupPlanLabel } from "@/lib/signup-plans";

type CardPayload = {
  userId: string;
  email: string;
  name: string;
  username?: string;
  createdAt: string;
  planLabel: string;
  coachingMode: string;
  profile: MemberProfile;
  businessUpgradeQueuePosition?: number | null;
  businessUpgradeQueueSize?: number | null;
};

type FormState = {
  name: string;
  username: string;
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
  calorieMin: string;
  calorieRangeMax: string;
  calorieHardMax: string;
  dailyReminderTime: string;
  smsReminderCadence: "consistent" | "minimum" | "";
  notes: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    username: "",
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
    calorieMin: "",
    calorieRangeMax: "",
    calorieHardMax: "",
    dailyReminderTime: "",
    smsReminderCadence: "",
    notes: "",
  };
}

function formFromCard(card: CardPayload): FormState {
  const p = card.profile;
  return {
    name: card.name || "",
    username: card.username || "",
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
    calorieMin: p.calorieMin != null ? String(p.calorieMin) : "",
    calorieRangeMax: p.calorieRangeMax != null ? String(p.calorieRangeMax) : "",
    calorieHardMax: p.calorieHardMax != null ? String(p.calorieHardMax) : "",
    dailyReminderTime: p.dailyReminderTime || "",
    smsReminderCadence: p.smsReminderCadence || "",
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
  const [saveFlash, setSaveFlash] = useState(0);
  const [addingGoal, setAddingGoal] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [upgradeActing, setUpgradeActing] = useState<"approve" | "decline" | null>(null);

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

  useEffect(() => {
    if (!saveFlash) return;
    const id = window.setTimeout(() => setSaveFlash(0), 1800);
    return () => window.clearTimeout(id);
  }, [saveFlash]);

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
        username: form.username.trim() || null,
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
        calorieMin: form.calorieMin.trim() ? Number(form.calorieMin) : null,
        calorieRangeMax: form.calorieRangeMax.trim() ? Number(form.calorieRangeMax) : null,
        calorieHardMax: form.calorieHardMax.trim() ? Number(form.calorieHardMax) : null,
        dailyReminderTime: form.dailyReminderTime || null,
        smsReminderCadence: form.smsReminderCadence || null,
        notes: form.notes.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not save member card.");
      return false;
    }
    const next = data as CardPayload;
    setCard(next);
    setForm(formFromCard(next));
    setSavedAt(new Date().toISOString());
    setSaveFlash((n) => n + 1);
    return true;
  }, [form, userId]);

  function calorieThresholdsReady() {
    const min = Number(form.calorieMin);
    const rangeMax = Number(form.calorieRangeMax);
    const hardMax = Number(form.calorieHardMax);
    return (
      form.calorieMin.trim() !== "" &&
      form.calorieRangeMax.trim() !== "" &&
      form.calorieHardMax.trim() !== "" &&
      min < rangeMax &&
      rangeMax < hardMax
    );
  }

  async function signOffIntake() {
    if (!calorieThresholdsReady()) {
      setError(
        "Set the daily calorie minimum, range top, and hard total before signing off the 15-minute intro.",
      );
      return;
    }
    setIntakeSigning(true);
    if (dirty) {
      const saved = await saveCard();
      if (!saved) {
        setIntakeSigning(false);
        return;
      }
    } else {
      setError("");
    }
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

  async function reviewBusinessUpgrade(action: "approve" | "decline") {
    const stripeBit =
      action === "approve"
        ? "Complimentary Business Class. Their Stripe price does not change. Buying Business Class at checkout is still $50/mo."
        : "They stay on Coach Class and can request again.";
    if (
      !window.confirm(
        `${action === "approve" ? "Approve" : "Decline"} Business Class upgrade for ${card?.name}?\n\n${stripeBit}`,
      )
    ) {
      return;
    }
    setUpgradeActing(action);
    setError("");
    const res = await fetch(`/api/admin/members/${encodeURIComponent(userId)}/business-upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || `Could not ${action} the upgrade.`);
    } else {
      await load();
    }
    setUpgradeActing(null);
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

      {profile.businessUpgradeStatus === "pending" ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">
            Airline-style upgrade request
          </p>
          <p className="mt-1 text-sm text-[var(--text)]">
            {card.name} asked to upgrade Coach Class → Business Class
            {profile.businessUpgradeRequestedAt
              ? ` · ${formatWhen(profile.businessUpgradeRequestedAt)}`
              : ""}
            {card.businessUpgradeQueuePosition
              ? ` · ${ordinalPlace(card.businessUpgradeQueuePosition)} of ${card.businessUpgradeQueueSize ?? "?"} on the list`
              : ""}
            .
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Approve gives Business Class at no extra charge. Their Stripe price stays.
            Buying Business Class at checkout is still $50/mo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-xs px-3 py-1.5"
              disabled={upgradeActing !== null}
              onClick={() => void reviewBusinessUpgrade("approve")}
            >
              {upgradeActing === "approve" ? "…" : "Approve upgrade"}
            </button>
            <button
              type="button"
              className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-rose-500/30 text-rose-300"
              disabled={upgradeActing !== null}
              onClick={() => void reviewBusinessUpgrade("decline")}
            >
              {upgradeActing === "decline" ? "…" : "Decline"}
            </button>
          </div>
        </div>
      ) : null}

      <section className="relative overflow-hidden rounded-[28px] border-2 border-[color-mix(in_srgb,var(--ramp-gold)_42%,var(--border))] bg-[var(--surface)] shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
        {saveFlash > 0 ? (
          <div key={saveFlash} className="pointer-events-none absolute inset-0 z-20" aria-live="polite">
            <div className="member-card-save-ring absolute inset-0 rounded-[26px]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="score-points-3d saved-pop-fade">Saved</p>
            </div>
          </div>
        ) : null}
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
            <label className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Username
              <input
                value={form.username}
                onChange={(e) => patchForm("username", e.target.value)}
                maxLength={24}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="At least 3 characters, unique"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm font-medium normal-case tracking-normal text-[var(--text)] outline-none"
              />
            </label>
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
            {profile.businessUpgradeStatus === "pending" ? (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                Upgrade requested
              </span>
            ) : null}
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
                <div className="sm:col-span-2">
                  <Field label="Texts — ask on the intro">
                    <p className="mb-2 text-xs text-[var(--muted)]">
                      Do they want a text every training day, or only the important ones (class,
                      missed day, 15 minutes with you)?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                          form.smsReminderCadence === "consistent"
                            ? "bg-[#7c3aed]/30 text-white ring-[#7c3aed]"
                            : "bg-[var(--bg)] text-[var(--muted)] ring-[var(--border)]"
                        }`}
                        onClick={() => patchForm("smsReminderCadence", "consistent")}
                      >
                        Consistent
                      </button>
                      <button
                        type="button"
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                          form.smsReminderCadence === "minimum"
                            ? "bg-[#7c3aed]/30 text-white ring-[#7c3aed]"
                            : "bg-[var(--bg)] text-[var(--muted)] ring-[var(--border)]"
                        }`}
                        onClick={() => patchForm("smsReminderCadence", "minimum")}
                      >
                        Minimum
                      </button>
                    </div>
                  </Field>
                </div>
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
                    value={
                      addingGoal ||
                      (form.primaryGoal &&
                        !PRIMARY_GOALS.some((g) => g.id === form.primaryGoal))
                        ? "__custom__"
                        : form.primaryGoal
                    }
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setAddingGoal(true);
                        patchForm("primaryGoal", "");
                        return;
                      }
                      setAddingGoal(false);
                      patchForm("primaryGoal", e.target.value);
                    }}
                  >
                    <option value="">Not set</option>
                    {PRIMARY_GOALS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                    <option value="__custom__">Add new…</option>
                  </select>
                  {addingGoal ||
                  (form.primaryGoal &&
                    !PRIMARY_GOALS.some((g) => g.id === form.primaryGoal)) ? (
                    <input
                      className={`${inputClass} mt-2`}
                      value={form.primaryGoal}
                      maxLength={120}
                      placeholder="Type their goal"
                      onChange={(e) => patchForm("primaryGoal", e.target.value)}
                    />
                  ) : null}
                </Field>
                <Field label="Fat-loss target">
                  <input
                    className={inputClass}
                    value={form.weightLossGoal}
                    onChange={(e) => patchForm("weightLossGoal", e.target.value)}
                    placeholder="Drop 20 lbs for the wedding"
                  />
                </Field>
                <Field label="Timeline — how long for the fat-loss target">
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

            <div
              className={`rounded-xl border p-4 ${
                !intakeDone && !calorieThresholdsReady()
                  ? "border-amber-400/50"
                  : "border-[var(--border)]"
              }`}
            >
              <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--ramp-gold-light)]">
                Calorie thresholds
              </h2>
              <p className="mb-3 text-xs text-[var(--muted)]">
                Set these on the 15-minute intro. Save anytime after to change them. Under the minimum the Nutrition number keeps a gold outline. Through the range top it is emerald. Over that, deep orange. Past the hard total, red.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Daily minimum">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={form.calorieMin}
                    onChange={(e) => patchForm("calorieMin", e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="1200"
                  />
                </Field>
                <Field label="Range top">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={form.calorieRangeMax}
                    onChange={(e) => patchForm("calorieRangeMax", e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="1800"
                  />
                </Field>
                <Field label="Hard total">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={form.calorieHardMax}
                    onChange={(e) => patchForm("calorieHardMax", e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="2200"
                  />
                </Field>
              </div>
              {!calorieThresholdsReady() ? (
                <p className="mt-2 text-xs text-amber-300">
                  {form.calorieMin || form.calorieRangeMax || form.calorieHardMax
                    ? "Minimum, then range top, then hard total — each number higher than the one before."
                    : "Required on the 15-minute intro. Save still changes them later."}
                </p>
              ) : !intakeDone ? (
                <p className="mt-2 text-xs text-emerald-300">
                  Ready to sign off. Save anytime after to change them.
                </p>
              ) : null}
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
              disabled={saving}
              className="btn-primary text-xs px-4 py-2"
            >
              {saving ? "Saving…" : "Save card"}
            </button>
            {!intakeDone ? (
              <button
                type="button"
                onClick={() => void signOffIntake()}
                disabled={intakeSigning || !calorieThresholdsReady()}
                title={
                  calorieThresholdsReady()
                    ? "Sign off the 15-minute intro"
                    : "Set calorie thresholds first"
                }
                className="btn-ghost text-xs px-4 py-2 ring-1 ring-sky-500/40 text-sky-300 disabled:opacity-50"
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
