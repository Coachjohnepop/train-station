"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import MemberHomeEquipment from "@/components/MemberHomeEquipment";
import MembershipSeatArt from "@/components/MembershipSeatArt";
import YoutubeAutoplayFrame from "@/components/YoutubeAutoplayFrame";
import { welcomeVideoUrlForPlan } from "@/lib/landing-media";
import {
  normalizeSignupPlan,
  signupPlanLabel,
  type SignupPlan,
} from "@/lib/signup-plans";
import TimeScrollPicker from "@/components/TimeScrollPicker";
import PhoneInput from "@/components/PhoneInput";
import QuickAuthSetupPrompt from "@/components/QuickAuthSetupPrompt";
import CityStateInput from "@/components/CityStateInput";
import ProgramStartDatePicker from "@/components/ProgramStartDatePicker";
import { localTodayIso } from "@/lib/program-calendar";
import { isPaidOffer } from "@/lib/product-offers";
import { recommendedProgramStartDate } from "@/lib/member-program-block";
import type { ProgramStartSettings } from "@/lib/program-start-settings";
import { weekdayLabel } from "@/lib/program-start-settings";
import { TICKET_TIERS } from "@/lib/landing-tickets";
import {
  membershipThemeTierFromPlan,
  seatArtForPlan,
} from "@/lib/membership-theme";

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
  welcomeVideosByPlan = {},
  programStartSettings,
}: {
  email?: string;
  welcomeVideoUrl?: string | null;
  welcomeVideosByPlan?: Record<string, string | null | undefined>;
  programStartSettings?: ProgramStartSettings;
}) {
  const searchParams = useSearchParams();
  const plan = normalizeSignupPlan(searchParams.get("plan"));
  const programSlug = searchParams.get("program");

  const needsStartDate = isPaidOffer(plan);
  const totalSteps = needsStartDate ? 7 : 6;
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
  const [programStartDate, setProgramStartDate] = useState(() =>
    recommendedProgramStartDate(localTodayIso(), programStartSettings),
  );
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planWelcomeUrl = welcomeVideoUrlForPlan(plan, welcomeVideoUrl, welcomeVideosByPlan);

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
    setCurrentStep((s) => Math.min(totalSteps, s + 1));
  }

  function prevStep() {
    setCurrentStep((s) => Math.max(1, s - 1));
  }

  async function handleFinish() {
    setFinishing(true);
    setError(null);
    try {
      const smsStep = needsStartDate ? 7 : 6;
      if (currentStep === smsStep) {
        await saveProgress({
          phone: sms.phone || null,
          dailyReminderTime: sms.dailyReminderTime || null,
        });
      }

      const res = await fetch("/api/onboard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          measurements,
          notes: measurements.notes,
          location,
          phone: sms.phone,
          dailyReminderTime: sms.dailyReminderTime,
          programSlug: programSlug || undefined,
          programStartDate: needsStartDate ? programStartDate : localTodayIso(),
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
      window.location.replace(data.redirectTo || "/member");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Finish failed");
    } finally {
      setFinishing(false);
    }
  }

  const tier = membershipThemeTierFromPlan(plan);
  const seatSrc = seatArtForPlan(plan as SignupPlan);

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
            {/* Train ticket hero — same seat art as landing / checkout */}
            <div className="payment-seat-card overflow-hidden rounded-xl border border-[var(--border)]">
              <MembershipSeatArt
                plan={plan as SignupPlan}
                membershipTier={tier}
                className="w-full"
                priority
              />
              <div className="flex gap-1.5 overflow-x-auto bg-[var(--surface-2)] p-2">
                {TICKET_TIERS.map((t) => {
                  const active = t.signupPlan === plan;
                  return (
                    <div
                      key={t.id}
                      className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border ${
                        active
                          ? "border-accent ring-1 ring-accent"
                          : "border-[var(--border)] opacity-60"
                      }`}
                      title={t.title}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={t.seatArtSrc || seatSrc || "/images/tickets/coach-class.jpg"}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      {active ? (
                        <span className="absolute inset-x-0 bottom-0 bg-black/70 px-0.5 py-0.5 text-center text-[7px] font-bold uppercase tracking-wide text-white">
                          Yours
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <h1 className="text-xl font-bold">Welcome aboard</h1>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              You&apos;re on <strong className="text-[var(--text)]">{signupPlanLabel(plan)}</strong>.
              A quick setup for texts and your profile — then your dashboard walks you through booking
              your coach intro and warming up.
            </p>
            <p className="text-xs text-[var(--muted)]">
              Need something first?{" "}
              <Link href="/member/account" className="font-semibold text-accent hover:underline">
                Open Account
              </Link>{" "}
              (payment confirmation, settings). Today and Home will bring you back here until setup
              is done.
            </p>
            {planWelcomeUrl ? (
              <div className="aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-[#3d2660]">
                <YoutubeAutoplayFrame
                  className="h-full w-full"
                  videoUrl={planWelcomeUrl}
                  title="Welcome video"
                  autoplay
                  kickPlayback={currentStep === 1}
                />
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)] italic">
                Your coach welcome clip will appear here soon — your train seat is ready either way.
              </p>
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
            <div className="pt-1">
              <CityStateInput
                enabled={currentStep === 5}
                city={location.city}
                state={location.state}
                onCityChange={(city) => setLocation((prev) => ({ ...prev, city }))}
                onStateChange={(state) => setLocation((prev) => ({ ...prev, state }))}
              />
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

        {needsStartDate && currentStep === 6 && (
          <>
            <h2 className="text-lg font-semibold">When do you want to start?</h2>
            <p className="text-sm text-[var(--muted)]">
              Your membership unlocks {programStartSettings?.blockDays ?? 28} days of workouts.
              {programStartSettings?.recommendWeekday != null ? (
                <>
                  {" "}
                  We recommend starting on{" "}
                  <strong className="text-emerald-200">
                    {weekdayLabel(programStartSettings.recommendWeekday)}
                  </strong>{" "}
                  so Day 1 matches the training week
                  {programStartSettings.recommendWeekday === 1
                    ? " — especially if you lift on weekends"
                    : ""}
                  .
                </>
              ) : (
                " Pick when Day 1 begins."
              )}{" "}
              You can schedule up to {programStartSettings?.maxOffsetDays ?? 6} days out.
            </p>
            <ProgramStartDatePicker
              value={programStartDate}
              onChange={setProgramStartDate}
              settings={programStartSettings}
            />
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

        {currentStep === (needsStartDate ? 7 : 6) && (
          <>
            <h2 className="text-lg font-semibold">Daily workout texts</h2>
            <p className="text-sm text-[var(--muted)]">
              Get a morning reminder in Messages (and a home-screen badge if you installed the app). On your dashboard next,
              you&apos;ll book your 15-minute coach intro and start your guided warm-ups.
            </p>
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">Mobile number</label>
                <PhoneInput
                  value={sms.phone}
                  onChange={(phone) => setSms({ ...sms, phone })}
                  placeholder="916.284.1994"
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
              <button
                type="button"
                onClick={() => void handleFinish()}
                disabled={finishing}
                className="btn-primary flex-1"
              >
                {finishing
                  ? "Finishing…"
                  : needsStartDate
                    ? "Finish setup"
                    : programSlug
                      ? "Finish & start Day 1"
                      : "Finish & go to dashboard"}
              </button>
            </div>
          </>
        )}
      </div>

      {error && <p className="text-sm text-amber-400 text-center">{error}</p>}

      <p className="text-[10px] text-center text-[var(--muted)] pb-4">
        Tip: add this site to your iPhone home screen after setup for app-like access.
      </p>
    </div>
  );
}