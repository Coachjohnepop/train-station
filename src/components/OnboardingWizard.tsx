"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import GearTabShopHint from "@/components/GearTabShopHint";
import MemberHomeEquipment from "@/components/MemberHomeEquipment";
import MembershipSeatArt from "@/components/MembershipSeatArt";
import PlayableVideoFrame from "@/components/PlayableVideoFrame";
import { welcomeVideoUrlForPlan } from "@/lib/landing-media";
import {
  normalizeSignupPlan,
  signupPlanLabel,
  type SignupPlan,
} from "@/lib/signup-plans";
import TimeScrollPicker from "@/components/TimeScrollPicker";
import PhoneInput from "@/components/PhoneInput";
import QuickAuthSetupPrompt from "@/components/QuickAuthSetupPrompt";
import MemberIntakeIntroCard from "@/components/MemberIntakeIntroCard";
import CityStateInput from "@/components/CityStateInput";
import ProgramStartDatePicker from "@/components/ProgramStartDatePicker";
import { localTodayIso } from "@/lib/program-calendar";
import { isPaidOffer } from "@/lib/product-offers";
import { recommendedProgramStartDate } from "@/lib/member-program-block";
import type { ProgramStartSettings } from "@/lib/program-start-settings";
import { weekdayLabel } from "@/lib/program-start-settings";
import { membershipThemeTierFromPlan } from "@/lib/membership-theme";
import { useUploadedContentVolumeDb } from "@/hooks/useUploadedContentVolumeDb";
import {
  PRIMARY_GOALS,
  WEIGHT_LOSS_TIMELINES,
  WORKOUT_SCHEDULES,
  isFatLossGoal,
  type OnboardGender,
  type PrimaryGoalId,
  type WorkoutScheduleId,
} from "@/lib/onboard-path";

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
  initialPlan,
}: {
  email?: string;
  welcomeVideoUrl?: string | null;
  welcomeVideosByPlan?: Record<string, string | null | undefined>;
  programStartSettings?: ProgramStartSettings;
  initialPlan?: string;
}) {
  const searchParams = useSearchParams();
  const plan = normalizeSignupPlan(searchParams.get("plan") || initialPlan);
  const programSlug = searchParams.get("program");

  const needsStartDate = isPaidOffer(plan);
  const totalSteps = needsStartDate ? 8 : 7;
  const bookStep = totalSteps;
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

  const [gender, setGender] = useState<OnboardGender | null>(null);
  const [measurements, setMeasurements] = useState({ weight: "", notes: "" });
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoalId | null>(null);
  const [workoutSchedule, setWorkoutSchedule] = useState<WorkoutScheduleId | null>(
    null,
  );
  const [weightLossGoal, setWeightLossGoal] = useState("");
  const [weightLossTimeline, setWeightLossTimeline] = useState("");
  const fatLoss = isFatLossGoal(primaryGoal);
  const [location, setLocation] = useState({ city: "", state: "" });
  const [sms, setSms] = useState({ phone: "", dailyReminderTime: "07:30" });
  const [programStartDate, setProgramStartDate] = useState(() =>
    recommendedProgramStartDate(localTodayIso(), programStartSettings),
  );
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planWelcomeUrl = welcomeVideoUrlForPlan(plan, welcomeVideoUrl, welcomeVideosByPlan);
  const introVolumeDb = useUploadedContentVolumeDb();

  async function nextStep() {
    setError(null);
    if (currentStep === 4) {
      if (!gender) {
        setError("Pick man or woman so we can set the right goals.");
        return;
      }
      if (!primaryGoal) {
        setError("Pick a main goal so Jeremy can personalize the plan.");
        return;
      }
      if (!workoutSchedule) {
        setError("Tell us how often you train now.");
        return;
      }
      await saveProgress({
        plan,
        gender,
        weightLbs: measurements.weight || null,
        primaryGoal,
        workoutSchedule,
        weightLossGoal: fatLoss ? weightLossGoal.trim() || null : null,
        weightLossTimeline: fatLoss ? weightLossTimeline.trim() || null : null,
        notes: measurements.notes || null,
      });
    }
    if (currentStep === 5) {
      await saveProgress({
        city: location.city || null,
        state: location.state || null,
      });
    }
    const smsStep = needsStartDate ? 7 : 6;
    if (currentStep === smsStep) {
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
      const smsStep = needsStartDate ? 7 : 6;
      if (currentStep === smsStep || currentStep === bookStep) {
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
          gender: gender || undefined,
          primaryGoal: primaryGoal || undefined,
          workoutSchedule: workoutSchedule || undefined,
          weightLossGoal: fatLoss ? weightLossGoal.trim() || undefined : undefined,
          weightLossTimeline: fatLoss ? weightLossTimeline.trim() || undefined : undefined,
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

  return (
    <div className="mx-auto max-w-md space-y-4 px-0 py-2 sm:px-4 sm:py-6 sm:space-y-6">
      {/* Step 1: video first on phone — minimal chrome above the fold */}
      {currentStep === 1 && planWelcomeUrl ? (
        <div className="overflow-hidden rounded-none bg-black ring-1 ring-[var(--border)] sm:rounded-xl">
          <div className="aspect-video w-full">
            <PlayableVideoFrame
              className="h-full w-full"
              videoUrl={planWelcomeUrl}
              title="Welcome video"
              autoplay
              kickPlayback
              duckBackgroundMusic
              volumeDb={introVolumeDb}
            />
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between px-4 sm:px-0">
        <span className="rounded-full bg-[#7c3aed]/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-fg)]">
          {signupPlanLabel(plan)}
        </span>
        <div className="text-xs text-[var(--muted)]">
          Step {currentStep} of {totalSteps}
        </div>
      </div>

      <div className="mx-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)] sm:mx-0">
        <div
          className="h-full rounded-full bg-[#7c3aed] transition-all duration-300"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>

      <div className="card mx-4 space-y-4 p-4 sm:mx-0 sm:p-6">
        {currentStep === 1 && (
          <>
            {/* No plan welcome URL: still do not lead with dual fan / huge seat */}
            {!planWelcomeUrl ? (
              <p className="text-xs italic text-[var(--muted)]">
                Your coach welcome clip will appear here soon — setup works either way.
              </p>
            ) : null}

            <h1 className="text-xl font-bold">Welcome aboard</h1>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              You&apos;re on <strong className="text-[var(--text)]">{signupPlanLabel(plan)}</strong>.
              A quick setup for texts and your profile — then your dashboard.
            </p>

            {/* Compact ticket only — scroll to see; never dual Coach/1st fan on phones */}
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
              <div className="w-[72px] shrink-0 overflow-hidden rounded-lg sm:w-[96px]">
                <MembershipSeatArt
                  plan={plan as SignupPlan}
                  membershipTier={tier}
                  className="w-full"
                  priority
                  alt={`${signupPlanLabel(plan)} ticket`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                  Your ticket
                </p>
                <p className="text-sm font-semibold text-[var(--text)]">{signupPlanLabel(plan)}</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  {planWelcomeUrl
                    ? "Coach video is above · tap Start when ready"
                    : "Tap Start setup when ready"}
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--muted)]">
              Need something first?{" "}
              <Link href="/member/account" className="font-semibold text-accent hover:underline">
                Open Account
              </Link>
              .
            </p>
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
            <GearTabShopHint />
            <h2 className="text-lg font-semibold">Home equipment</h2>
            <p className="text-sm text-[var(--muted)]">
              Check what you already have at home so workouts match your kit.
            </p>
            <p className="rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/10 px-3 py-2 text-xs text-[var(--text)]">
              This list is your home kit — not the store. To buy gear we sell, tap{" "}
              <strong className="text-[var(--accent-fg)]">Gear</strong> in the nav.
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
            <h2 className="text-lg font-semibold">About you</h2>
            <p className="text-sm text-[var(--muted)]">
              A few taps so Jeremy can make this personal. Tape measurements come after
              your 15-minute intro — not now.
            </p>
            <div className="space-y-4 pt-1">
              <div>
                <p className="mb-1.5 block text-xs text-[var(--muted)]">I am</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["man", "woman"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setGender(option)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                        gender === option
                          ? "border-accent bg-accent/15 text-[var(--text)]"
                          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
                      }`}
                    >
                      {option === "man" ? "Man" : "Woman"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">
                  Current weight (lbs)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={measurements.weight}
                  onChange={(e) => setMeasurements({ ...measurements, weight: e.target.value })}
                  placeholder="e.g. 165"
                  className="input w-full"
                />
              </div>
              <div>
                <p className="mb-1.5 block text-xs text-[var(--muted)]">
                  What&apos;s the main goal?
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRIMARY_GOALS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPrimaryGoal(option.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                        primaryGoal === option.id
                          ? "border-accent bg-accent/15 text-[var(--text)]"
                          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 block text-xs text-[var(--muted)]">
                  How often do you train now?
                </p>
                <div className="flex flex-wrap gap-2">
                  {WORKOUT_SCHEDULES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setWorkoutSchedule(option.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                        workoutSchedule === option.id
                          ? "border-accent bg-accent/15 text-[var(--text)]"
                          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {fatLoss ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--muted)]">
                      How much, if you know (optional)
                    </label>
                    <input
                      type="text"
                      value={weightLossGoal}
                      onChange={(e) => setWeightLossGoal(e.target.value)}
                      placeholder="e.g. Lose 20 pounds"
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 block text-xs text-[var(--muted)]">Timeline</p>
                    <div className="flex flex-wrap gap-2">
                      {WEIGHT_LOSS_TIMELINES.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setWeightLossTimeline(option)}
                          className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                            weightLossTimeline === option
                              ? "border-accent bg-accent/15 text-[var(--text)]"
                              : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={
                        (WEIGHT_LOSS_TIMELINES as readonly string[]).includes(weightLossTimeline)
                          ? ""
                          : weightLossTimeline
                      }
                      onChange={(e) => setWeightLossTimeline(e.target.value)}
                      placeholder="Or type your own — e.g. by Thanksgiving"
                      className="input mt-2 w-full"
                    />
                  </div>
                </>
              ) : null}
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">
                  Anything else for Jeremy (optional)
                </label>
                <textarea
                  value={measurements.notes}
                  onChange={(e) => setMeasurements({ ...measurements, notes: e.target.value })}
                  placeholder="Injuries, preferences, what has or hasn’t worked…"
                  className="input h-20 w-full"
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
              Get a morning reminder in Messages (and a home-screen badge if you installed the app).
              After this you go to Today — Jeremy&apos;s program workouts are ready. An intro call
              is optional.
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
              <button type="button" onClick={() => void nextStep()} className="btn-primary flex-1">
                Continue
              </button>
            </div>
          </>
        )}

        {currentStep === bookStep && (
          <>
            <h2 className="text-lg font-semibold">Book your free 15-minute intro</h2>
            <p className="text-sm text-[var(--muted)]">
              This is the next required step. Jeremy uses it to lock your plan. Tape measurements
              happen after that call — not now.
            </p>
            <MemberIntakeIntroCard compact onBooked={() => void handleFinish()} />
            {finishing ? (
              <p className="text-sm text-[var(--muted)]">Saving setup…</p>
            ) : (
              <button type="button" onClick={prevStep} className="btn-ghost w-full">
                Back
              </button>
            )}
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