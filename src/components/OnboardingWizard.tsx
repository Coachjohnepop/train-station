"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import MemberHomeEquipment from "@/components/MemberHomeEquipment";
import { landingVideoEmbedSrc } from "@/lib/landing-media";
import { normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";
import { COACH_CALENDLY_URL } from "@/lib/brand";
import TimeScrollPicker from "@/components/TimeScrollPicker";
import QuickAuthSetupPrompt from "@/components/QuickAuthSetupPrompt";
import EmbeddedCalendlyModal from "@/components/EmbeddedCalendlyModal";

async function saveProgress(body: Record<string, unknown>) {
  await fetch("/api/member/onboard-progress", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function OnboardingWizard({
  email = "",
  welcomeVideoUrl = null,
  calendlyUrl = null,
}: {
  email?: string;
  welcomeVideoUrl?: string | null;
  calendlyUrl?: string | null;
}) {
  const searchParams = useSearchParams();
  const plan = normalizeSignupPlan(searchParams.get("plan"));
  const programSlug = searchParams.get("program");

  const totalSteps = 7;
  const stepStorageKey = `ts-onboard-step:${plan}`;
  const [currentStep, setCurrentStep] = useState(1);
  const [stepReady, setStepReady] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(stepStorageKey);
      if (saved) {
        const n = Number.parseInt(saved, 10);
        if (n >= 1 && n <= totalSteps) setCurrentStep(n);
      }
    } catch {
      // ignore private browsing / storage blocks
    }
    setStepReady(true);
  }, [stepStorageKey, totalSteps]);

  useEffect(() => {
    if (!stepReady) return;
    try {
      sessionStorage.setItem(stepStorageKey, String(currentStep));
    } catch {
      // ignore
    }
  }, [currentStep, stepReady, stepStorageKey]);
  const [measurements, setMeasurements] = useState({ weight: "", notes: "" });
  const [location, setLocation] = useState({ city: "", state: "" });
  const [sms, setSms] = useState({ phone: "", dailyReminderTime: "07:30" });
  const [calendlyOpened, setCalendlyOpened] = useState(false);
  const [calendlyBooked, setCalendlyBooked] = useState(false);
  const [calendlyModalOpen, setCalendlyModalOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveCalendly = calendlyUrl || COACH_CALENDLY_URL;
  const welcomeEmbed = landingVideoEmbedSrc(welcomeVideoUrl);

  async function nextStep() {
    setError(null);
    if (currentStep === 4) {
      await saveProgress({
        plan,
        weightLbs: measurements.weight || null,
        notes: measurements.notes || null,
      });
    }
    if (currentStep === 5) {
      await saveProgress({
        city: location.city || null,
        state: location.state || null,
      });
    }
    if (currentStep === 6) {
      await saveProgress({
        phone: sms.phone || null,
        dailyReminderTime: sms.dailyReminderTime || null,
      });
    }
    setCurrentStep((s) => Math.min(totalSteps, s + 1));
  }

  function prevStep() {
    setCurrentStep((s) => Math.max(1, s - 1));
  }

  async function handleFinish() {
    setFinishing(true);
    setError(null);
    try {
      const res = await fetch("/api/onboard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          measurements,
          notes: measurements.notes,
          location,
          phone: sms.phone,
          dailyReminderTime: sms.dailyReminderTime,
          calendlyOpened,
          programSlug: programSlug || undefined,
          plan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not finish setup");
      try {
        sessionStorage.removeItem(stepStorageKey);
      } catch {
        // ignore
      }
      window.location.href = data.redirectTo || "/member/today";
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Finish failed");
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-[#7c3aed]/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#c4b5fd]">
          {signupPlanLabel(plan)}
        </span>
        <div className="text-xs text-[var(--muted)]">
          Step {currentStep} of {totalSteps}
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full bg-[#7c3aed] transition-all duration-300"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>

      <div className="card p-5 sm:p-6 space-y-4">
        {currentStep === 1 && (
          <>
            <h1 className="text-xl font-bold">Welcome aboard</h1>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              Two minutes to set up texts, book your coach, and open your training dashboard on your phone.
            </p>
            {welcomeEmbed ? (
              <div className="aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-[#3d2660]">
                <iframe
                  className="h-full w-full"
                  src={welcomeEmbed}
                  title="Welcome video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)] italic">Your coach welcome clip will appear here soon.</p>
            )}
            <button type="button" onClick={() => void nextStep()} className="btn-primary w-full">
              Start setup
            </button>
          </>
        )}

        {currentStep === 2 && email && (
          <QuickAuthSetupPrompt email={email} onContinue={() => void nextStep()} />
        )}

        {currentStep === 2 && !email && (
          <>
            <p className="text-sm text-[var(--muted)]">Quick sign-in setup is available after sign-in.</p>
            <button type="button" onClick={() => void nextStep()} className="btn-primary w-full">
              Continue
            </button>
          </>
        )}

        {currentStep === 3 && (
          <>
            <h2 className="text-lg font-semibold">Home equipment</h2>
            <p className="text-sm text-[var(--muted)]">
              Check what you have at home so we can show realistic workout options.
            </p>
            <MemberHomeEquipment defaultOpen />
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={prevStep} className="btn-ghost flex-1">
                Back
              </button>
              <button type="button" onClick={() => void nextStep()} className="btn-primary flex-1">
                Continue
              </button>
            </div>
          </>
        )}

        {currentStep === 4 && (
          <>
            <h2 className="text-lg font-semibold">Quick measurements</h2>
            <p className="text-sm text-[var(--muted)]">Optional — helps your coach track progress.</p>
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">Current weight (lbs)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={measurements.weight}
                  onChange={(e) => setMeasurements({ ...measurements, weight: e.target.value })}
                  placeholder="e.g. 185"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">Notes (optional)</label>
                <textarea
                  value={measurements.notes}
                  onChange={(e) => setMeasurements({ ...measurements, notes: e.target.value })}
                  placeholder="Injuries, goals, preferences…"
                  className="input w-full h-20"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={prevStep} className="btn-ghost flex-1">
                Back
              </button>
              <button type="button" onClick={() => void nextStep()} className="btn-primary flex-1">
                Save &amp; continue
              </button>
            </div>
          </>
        )}

        {currentStep === 5 && (
          <>
            <h2 className="text-lg font-semibold">Where are you training from?</h2>
            <p className="text-sm text-[var(--muted)]">
              City and state power weather hints in your workout console.
            </p>
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">City</label>
                <input
                  type="text"
                  autoComplete="address-level2"
                  value={location.city}
                  onChange={(e) => setLocation({ ...location, city: e.target.value })}
                  placeholder="e.g. Austin"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">State</label>
                <input
                  type="text"
                  autoComplete="address-level1"
                  value={location.state}
                  onChange={(e) => setLocation({ ...location, state: e.target.value.toUpperCase() })}
                  placeholder="TX"
                  maxLength={2}
                  className="input w-full uppercase"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={prevStep} className="btn-ghost flex-1">
                Back
              </button>
              <button type="button" onClick={() => void nextStep()} className="btn-primary flex-1">
                Continue
              </button>
            </div>
          </>
        )}

        {currentStep === 6 && (
          <>
            <h2 className="text-lg font-semibold">Daily workout texts</h2>
            <p className="text-sm text-[var(--muted)]">
              Get a morning SMS with a direct link to that day&apos;s workout.
            </p>
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">Mobile number</label>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={sms.phone}
                  onChange={(e) => setSms({ ...sms, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)] block mb-2">Reminder time</label>
                <TimeScrollPicker
                  value={sms.dailyReminderTime}
                  onChange={(dailyReminderTime) => setSms({ ...sms, dailyReminderTime })}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={prevStep} className="btn-ghost flex-1">
                Back
              </button>
              <button type="button" onClick={() => void nextStep()} className="btn-primary flex-1">
                Continue
              </button>
            </div>
          </>
        )}

        {currentStep === 7 && (
          <>
            <h2 className="text-lg font-semibold">Book your first session with your trainer, Jeremy</h2>
            <p className="text-sm text-[var(--muted)]">
              Pick a time that works for you. You can also do this later from your dashboard.
            </p>
            {calendlyBooked ? (
              <p className="rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--success)]">
                Session booked — you&apos;ll get a confirmation email with your Zoom link.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCalendlyOpened(true);
                  setCalendlyModalOpen(true);
                }}
                className="btn-primary w-full"
              >
                Book your session
              </button>
            )}
            <p className="text-[11px] text-[var(--muted)]">
              Scheduling opens here on thetrainstation.co — when you&apos;re done you&apos;ll land right back in this step.
            </p>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={prevStep} className="btn-ghost flex-1">
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleFinish()}
                disabled={finishing}
                className="btn-primary flex-1"
              >
                {finishing
                  ? "Finishing…"
                  : programSlug
                    ? "Finish & start Day 1"
                    : "Finish & go to dashboard"}
              </button>
            </div>
          </>
        )}
      </div>

      <EmbeddedCalendlyModal
        open={calendlyModalOpen}
        calendlyUrl={effectiveCalendly}
        prefill={email ? { email } : undefined}
        title="Book with Coach Jeremy"
        onClose={() => setCalendlyModalOpen(false)}
        onScheduled={() => {
          setCalendlyBooked(true);
          setCalendlyOpened(true);
        }}
      />

      {error && <p className="text-sm text-amber-400 text-center">{error}</p>}

      <p className="text-[10px] text-center text-[var(--muted)] pb-4">
        Tip: add this site to your iPhone home screen after setup for app-like access.
      </p>
    </div>
  );
}