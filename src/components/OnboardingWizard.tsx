"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import OnboardActionDock from "@/components/OnboardActionDock";
import MembershipSeatArt from "@/components/MembershipSeatArt";
import PlayableVideoFrame from "@/components/PlayableVideoFrame";
import { welcomeVideoUrlForPlan } from "@/lib/landing-media";
import {
  normalizeSignupPlan,
  signupPlanLabel,
  type SignupPlan,
} from "@/lib/signup-plans";
import QuickAuthSetupPrompt from "@/components/QuickAuthSetupPrompt";
import MemberIntakeIntroCard from "@/components/MemberIntakeIntroCard";
import { localTodayIso } from "@/lib/program-calendar";
import { isPaidOffer } from "@/lib/product-offers";
import { defaultProgramStartDate } from "@/lib/member-program-block";
import type { ProgramStartSettings } from "@/lib/program-start-settings";
import { membershipThemeTierFromPlan } from "@/lib/membership-theme";
import { useUploadedContentVolumeDb } from "@/hooks/useUploadedContentVolumeDb";
import { normalizeOnboardGender, type OnboardGender } from "@/lib/onboard-path";
import { NextStepButton } from "@/components/NextStepButton";

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
  const totalSteps = 3;
  const bookStep = 3;
  const stepStorageKey = `ts-onboard-step:${plan}`;
  const genderStorageKey = `ts-onboard-gender:${plan}`;
  const [currentStep, setCurrentStep] = useState(1);
  const [stepReady, setStepReady] = useState(false);
  const [gender, setGender] = useState<OnboardGender | null>(() =>
    normalizeOnboardGender(initialGender),
  );
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(stepStorageKey);
      if (saved) {
        const n = Number.parseInt(saved, 10);
        if (n >= 1 && n <= totalSteps) setCurrentStep(n);
        else if (n > totalSteps) setCurrentStep(bookStep);
      }
      const storedGender = normalizeOnboardGender(sessionStorage.getItem(genderStorageKey));
      if (storedGender) setGender(storedGender);
    } catch {
      // ignore private browsing / storage blocks
    }
    setStepReady(true);
  }, [stepStorageKey, genderStorageKey, totalSteps, bookStep]);

  useEffect(() => {
    if (!stepReady) return;
    try {
      sessionStorage.setItem(stepStorageKey, String(currentStep));
    } catch {
      // ignore
    }
  }, [currentStep, stepReady, stepStorageKey]);

  const planWelcomeUrl = welcomeVideoUrlForPlan(plan, welcomeVideoUrl, welcomeVideosByPlan);
  const introVolumeDb = useUploadedContentVolumeDb();
  const programStartDate = defaultProgramStartDate(localTodayIso(), programStartSettings);

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
    if (currentStep === 1 && gender) {
      await saveProgress({ plan, gender });
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
      await saveProgress({ plan, gender: resolvedGender });

      const res = await fetch("/api/onboard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: resolvedGender,
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
    <div className="onboard-tight mx-auto max-w-md space-y-4 px-0 py-2 sm:px-4 sm:py-6 sm:space-y-6">
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
            <NextStepButton onClick={() => void nextStep()}>Continue</NextStepButton>

            <h1 className="font-bold">Welcome aboard</h1>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              You&apos;re on <strong className="text-[var(--text)]">{signupPlanLabel(plan)}</strong>.
              Jeremy will get gear, weight, and goals on your intro call. Two taps, then Today.
            </p>

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
              </div>
            </div>

            {planWelcomeUrl ? (
              <div className="overflow-hidden rounded-xl bg-black ring-1 ring-[var(--border)]">
                <div className="mx-auto aspect-video w-full max-h-[22vh] sm:max-h-none">
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
            ) : (
              <p className="text-xs italic text-[var(--muted)]">
                Your coach welcome clip will appear here soon — setup works either way.
              </p>
            )}
          </>
        )}

        {currentStep === 2 && email && (
          <QuickAuthSetupPrompt email={email} onContinue={() => void nextStep()} />
        )}

        {currentStep === 2 && !email && (
          <>
            <p className="text-sm text-[var(--muted)]">Quick sign-in setup is available after sign-in.</p>
            <OnboardActionDock>
              <NextStepButton onClick={() => void nextStep()}>Continue</NextStepButton>
            </OnboardActionDock>
          </>
        )}

        {currentStep === bookStep && (
          <>
            {finishing ? (
              <p className="text-sm text-[var(--muted)]">Saving setup…</p>
            ) : (
              <NextStepButton onClick={() => void handleFinish()}>Continue</NextStepButton>
            )}
            <h2 className="font-semibold">Book your free 15-minute intro</h2>
            <p className="text-sm text-[var(--muted)]">
              Continue opens Today now. Book if you want Jeremy to fill in gear, weight, and
              goals on the call.
            </p>
            <MemberIntakeIntroCard compact onBooked={() => void handleFinish()} />
            {finishing ? null : (
              <OnboardActionDock>
                <button type="button" onClick={prevStep} className="btn-ghost min-h-12 w-full">
                  Back
                </button>
              </OnboardActionDock>
            )}
          </>
        )}
      </div>

      {error && <p className="text-center text-sm text-amber-400">{error}</p>}
    </div>
  );
}
