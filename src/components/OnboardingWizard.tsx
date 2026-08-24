"use client";

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
import { defaultProgramStartDate } from "@/lib/member-program-block";
import type { ProgramStartSettings } from "@/lib/program-start-settings";
import { weekdayLabel } from "@/lib/program-start-settings";
import { membershipThemeTierFromPlan } from "@/lib/membership-theme";
import { useUploadedContentVolumeDb } from "@/hooks/useUploadedContentVolumeDb";
import {
  PRIMARY_GOALS,
  WEIGHT_LOSS_TIMELINES,
  WORKOUT_SCHEDULES,
  isFatLossGoal,
  normalizeOnboardGender,
  type OnboardGender,
  type PrimaryGoalId,
  type WorkoutScheduleId,
} from "@/lib/onboard-path";

/** iOS Safari bottom chrome sits on top of in-flow buttons. Keep the dock above it. */
const PHONE_SAFARI_DOCK_PAD =
  "pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] sm:pb-0";

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
  initialGender = null,
}: {
  email?: string;
  welcomeVideoUrl?: string | null;
  welcomeVideosByPlan?: Record<string, string | null | undefined>;
  programStartSettings?: ProgramStartSettings;
  initialPlan?: string;
  initialGender?: string | null;
}) {
  const searchParams = useSearchParams();
  const plan = normalizeSignupPlan(searchParams.get("plan") || initialPlan);
  const programSlug = searchParams.get("program");

  const needsStartDate = isPaidOffer(plan);
  const totalSteps = 6;
  const kitStep = 3;
  const aboutStep = 4;
  const detailsStep = 5;
  const bookStep = 6;
  const stepStorageKey = `ts-onboard-step:${plan}`;
  const genderStorageKey = `ts-onboard-gender:${plan}`;
  const [currentStep, setCurrentStep] = useState(1);
  const [stepReady, setStepReady] = useState(false);
  const [gender, setGender] = useState<OnboardGender | null>(() =>
    normalizeOnboardGender(initialGender),
  );

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(stepStorageKey);
      if (saved) {
        const n = Number.parseInt(saved, 10);
        if (n >= 1 && n <= totalSteps) setCurrentStep(n);
      }
      const storedGender = normalizeOnboardGender(sessionStorage.getItem(genderStorageKey));
      if (storedGender) setGender(storedGender);
    } catch {
      // ignore private browsing / storage blocks
    }
    setStepReady(true);
  }, [stepStorageKey, genderStorageKey, totalSteps]);

  useEffect(() => {
    if (!stepReady) return;
    try {
      sessionStorage.setItem(stepStorageKey, String(currentStep));
    } catch {
      // ignore
    }
  }, [currentStep, stepReady, stepStorageKey]);
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
    defaultProgramStartDate(localTodayIso(), programStartSettings),
  );
  const [skipHealth, setSkipHealth] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planWelcomeUrl = welcomeVideoUrlForPlan(plan, welcomeVideoUrl, welcomeVideosByPlan);
  const introVolumeDb = useUploadedContentVolumeDb();

  function pickGender(option: OnboardGender) {
    setGender(option);
    setError(null);
    try {
      sessionStorage.setItem(genderStorageKey, option);
    } catch {
      // ignore
    }
    void saveProgress({ plan, gender: option });
  }

  async function nextStep() {
    setError(null);
    if (currentStep === 1 && !gender) {
      setError("Pick man or woman to continue.");
      return;
    }
    if (currentStep === aboutStep) {
      await saveProgress({
        plan,
        gender: gender || null,
        weightLbs: measurements.weight || null,
        startWeightLbs: measurements.weight || null,
        primaryGoal: primaryGoal || null,
        workoutSchedule: workoutSchedule || null,
        weightLossGoal: fatLoss ? weightLossGoal.trim() || null : null,
        weightLossTimeline: fatLoss ? weightLossTimeline.trim() || null : null,
        notes: measurements.notes || null,
      });
    }
    if (currentStep === detailsStep) {
      await saveProgress({
        city: location.city || null,
        state: location.state || null,
        phone: sms.phone || null,
        dailyReminderTime: sms.dailyReminderTime || null,
      });
    }
    if (currentStep === kitStep && skipHealth) {
      setCurrentStep(detailsStep);
      return;
    }
    setCurrentStep((s) => Math.min(totalSteps, s + 1));
  }

  function prevStep() {
    if (currentStep === detailsStep && skipHealth) {
      setCurrentStep(kitStep);
      return;
    }
    setCurrentStep((s) => Math.max(1, s - 1));
  }

  async function skipHealthForLater() {
    if (!gender) {
      setError("Pick man or woman first — then you can skip the rest.");
      return;
    }
    setSkipHealth(true);
    setError(null);
    try {
      sessionStorage.setItem(genderStorageKey, gender);
    } catch {
      // ignore
    }
    await saveProgress({ plan, gender });
    setCurrentStep(2);
  }

  async function handleFinish() {
    setFinishing(true);
    setError(null);
    try {
      let resolvedGender = gender;
      if (!resolvedGender) {
        try {
          resolvedGender = normalizeOnboardGender(sessionStorage.getItem(genderStorageKey));
        } catch {
          resolvedGender = null;
        }
      }
      if (!resolvedGender) {
        resolvedGender = normalizeOnboardGender(initialGender);
      }
      if (!resolvedGender) {
        setError("Pick man or woman so we can set the right goals.");
        setCurrentStep(1);
        setFinishing(false);
        return;
      }
      if (resolvedGender !== gender) setGender(resolvedGender);
      if (currentStep === detailsStep || currentStep === bookStep) {
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
          gender: resolvedGender,
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
        sessionStorage.removeItem(genderStorageKey);
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
      {/* Step 1: video first on phone — keep it short so Man/Woman + Start stay on screen */}
      {currentStep === 1 && planWelcomeUrl ? (
        <div className="overflow-hidden rounded-none bg-black ring-1 ring-[var(--border)] sm:rounded-xl">
          <div className="mx-auto aspect-video w-full max-h-[28vh] sm:max-h-none">
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
              Two minutes — then Today. Jeremy&apos;s intro is recommended, not a wall.
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
                    ? "Coach video is above · pick man or woman, then Start"
                    : "Pick man or woman, then Start setup"}
                </p>
              </div>
            </div>

            <div
              className={`sticky bottom-0 z-30 -mx-4 mt-2 space-y-3 border-t border-[var(--border)] bg-[var(--bg)]/95 px-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:backdrop-blur-none ${PHONE_SAFARI_DOCK_PAD}`}
            >
              <div>
                <p className="mb-1.5 block text-xs text-[var(--muted)]">I am</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["man", "woman"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => pickGender(option)}
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
              <button
                type="button"
                onClick={() => void nextStep()}
                className="btn-primary w-full min-h-12"
              >
                Start setup
              </button>
              <button
                type="button"
                onClick={() => void skipHealthForLater()}
                className="btn-ghost w-full"
              >
                Skip health details — I&apos;ll add them later
              </button>
            </div>
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

        {currentStep === aboutStep && (
          <>
            <h2 className="text-lg font-semibold">About you</h2>
            <p className="text-sm text-[var(--muted)]">
              Same questions for everyone. All optional — skip anything and add it later.
              Weight you enter here is your starting weight on file. Tape still waits
              until after Jeremy&apos;s intro.
            </p>
            <div className="space-y-4 pt-1">
              <div>
                <p className="mb-1.5 block text-xs text-[var(--muted)]">I am</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["man", "woman"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => pickGender(option)}
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
                  Current weight (lbs, optional)
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
                Continue
              </button>
            </div>
            <button
              type="button"
              onClick={() => void nextStep()}
              className="w-full text-center text-xs text-[var(--muted)] underline-offset-2 hover:underline"
            >
              Skip these for now
            </button>
          </>
        )}

        {currentStep === detailsStep && (
          <>
            <h2 className="text-lg font-semibold">Where and when</h2>
            <p className="text-sm text-[var(--muted)]">
              City powers weather on Today. Texts are optional. You can change these later.
            </p>
            <div className="space-y-5 pt-1">
              <CityStateInput
                enabled={currentStep === detailsStep}
                city={location.city}
                state={location.state}
                onCityChange={(city) => setLocation((prev) => ({ ...prev, city }))}
                onStateChange={(state) => setLocation((prev) => ({ ...prev, state }))}
              />
              {needsStartDate ? (
                <div>
                  <h3 className="text-sm font-semibold">When do you want Day 1?</h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {programStartSettings?.blockDays ?? 28} days of workouts. Start today or up to{" "}
                    {programStartSettings?.maxOffsetDays ?? 6} days out
                    {programStartSettings?.recommendWeekday != null ? (
                      <>
                        {" "}
                        (we like{" "}
                        <strong className="text-emerald-200">
                          {weekdayLabel(programStartSettings.recommendWeekday)}
                        </strong>
                        )
                      </>
                    ) : null}
                    .
                  </p>
                  <div className="mt-2">
                    <ProgramStartDatePicker
                      value={programStartDate}
                      onChange={setProgramStartDate}
                      settings={programStartSettings}
                    />
                  </div>
                </div>
              ) : null}
              <div>
                <h3 className="text-sm font-semibold">Daily workout texts</h3>
                <p className="mt-1 mb-2 text-xs text-[var(--muted)]">
                  Morning reminder in Messages. Skip if you just want the app.
                </p>
                <div className="space-y-3">
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
              Jeremy uses this to lock your plan. Tape waits until after that call. You can
              book now or from Today.
            </p>
            <MemberIntakeIntroCard compact onBooked={() => void handleFinish()} />
            {finishing ? (
              <p className="text-sm text-[var(--muted)]">Saving setup…</p>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => void handleFinish()}
                  className="btn-primary w-full min-h-12"
                >
                  Go to Today — I&apos;ll book from there
                </button>
                <button type="button" onClick={prevStep} className="btn-ghost w-full">
                  Back
                </button>
              </div>
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