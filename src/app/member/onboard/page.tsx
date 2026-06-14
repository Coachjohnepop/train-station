"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MemberHomeEquipment from "@/components/MemberHomeEquipment";
import { COACH_CALENDLY_URL } from "@/lib/brand";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const programSlug = searchParams.get("program");

  const [currentStep, setCurrentStep] = useState(1);
  const [measurements, setMeasurements] = useState({ weight: "", notes: "" });
  const [location, setLocation] = useState({ city: "", state: "" });
  const [completed, setCompleted] = useState(false);
  const [calendlyUrl, setCalendlyUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/contact")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.calendlyUrl) setCalendlyUrl(data.calendlyUrl);
      })
      .catch(() => {});
  }, []);

  const effectiveCalendly = calendlyUrl || COACH_CALENDLY_URL;

  const totalSteps = 5;

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      setCompleted(true);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleMeasurementsSave = () => {
    // For demo: in real would save to user profile / settings
    console.log("Saved measurements (demo):", measurements);
    nextStep();
  };

  const handleFinishSetup = async () => {
    try {
      await fetch('/api/onboard/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          measurements,
          notes: measurements.notes,
          location,
          calendlyOpened: true,
          programSlug: programSlug || undefined,
        }),
      });
    } catch (e) {
      console.error('Failed to send onboarding notification', e);
    }
    // For demo: persist location in cookies so weather can use it immediately
    if (location.city && location.state) {
      document.cookie = `ts_city=${encodeURIComponent(location.city)}; path=/; max-age=31536000`;
      document.cookie = `ts_state=${encodeURIComponent(location.state)}; path=/; max-age=31536000`;
    }
    setCompleted(true);
  };

  if (completed) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-6">
        <div className="text-4xl">🎉</div>
        <h1 className="text-2xl font-bold">You're all set!</h1>
        <p className="text-[var(--muted)]">
          Welcome to the team. Your equipment, measurements, and first booking are ready.
          A notification has been sent to the coach.
          Head to your dashboard to start training.
        </p>
        <Link href="/member" className="btn-primary inline-block">
          Go to Dashboard
        </Link>
        <p className="text-xs text-[var(--muted)] mt-4">
          (In a real flow this would also mark your onboarding complete and show the right ticket level.)
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/member" className="text-xs text-accent hover:underline">
          ← Skip for now
        </Link>
        <div className="text-xs text-[var(--muted)]">
          Step {currentStep} of {totalSteps}
        </div>
      </div>

      <div className="card p-6 space-y-4">
        {currentStep === 1 && (
          <>
            <h1 className="text-xl font-bold">Welcome to The Train Station!</h1>
            <p className="text-[var(--muted)]">
              This quick setup will get you the right program, equipment options, 
              and your first session booked. Takes about 2 minutes.
            </p>
            <div className="pt-2">
              <button
                onClick={nextStep}
                className="btn-primary w-full"
              >
                Start setup
              </button>
              <p className="text-[10px] text-center text-[var(--muted)] mt-2">
                (Watch the welcome video in a real version here — John &amp; Steph intro)
              </p>
            </div>
          </>
        )}

        {currentStep === 2 && (
          <>
            <h2 className="text-lg font-semibold">Tell us what you have at home</h2>
            <p className="text-sm text-[var(--muted)]">
              Check the items you can use for home workouts. This helps us show realistic options in your program.
            </p>
            <div className="pt-2">
              <MemberHomeEquipment />
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={prevStep} className="btn-ghost flex-1">Back</button>
              <button onClick={nextStep} className="btn-primary flex-1">Continue</button>
            </div>
          </>
        )}

        {currentStep === 3 && (
          <>
            <h2 className="text-lg font-semibold">Quick measurements</h2>
            <p className="text-sm text-[var(--muted)]">
              Morning scale weight (no clothes) helps us track progress. We can remind you every few days.
            </p>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">Current weight (lbs)</label>
                <input
                  type="number"
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
                  placeholder="Any injuries, goals, or preferences?"
                  className="input w-full h-20"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={prevStep} className="btn-ghost flex-1">Back</button>
              <button onClick={handleMeasurementsSave} className="btn-primary flex-1">Save &amp; continue</button>
            </div>
          </>
        )}

        {currentStep === 4 && (
          <>
            <h2 className="text-lg font-semibold">Where are you training from?</h2>
            <p className="text-sm text-[var(--muted)]">
              Your city and state let us show today's weather in your workout console. This helps your coach adjust plans (e.g. suggest outdoor drills on nice days or indoor alternatives on bad weather).
            </p>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">City</label>
                <input
                  type="text"
                  value={location.city}
                  onChange={(e) => setLocation({ ...location, city: e.target.value })}
                  placeholder="e.g. Austin"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">State (2-letter code)</label>
                <input
                  type="text"
                  value={location.state}
                  onChange={(e) => setLocation({ ...location, state: e.target.value.toUpperCase() })}
                  placeholder="e.g. TX"
                  maxLength={2}
                  className="input w-full uppercase"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={prevStep} className="btn-ghost flex-1">Back</button>
              <button onClick={nextStep} className="btn-primary flex-1">Continue</button>
            </div>
          </>
        )}

        {currentStep === 5 && (
          <>
            <h2 className="text-lg font-semibold">Book your first session</h2>
            <p className="text-sm text-[var(--muted)]">
              Pick a time with your coach. We'll send a reminder via SMS.
            </p>
            <div className="pt-4 space-y-3">
              <a
                href={effectiveCalendly}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary block text-center"
              >
                Open Calendly to book
              </a>
              <p className="text-xs text-center text-[var(--muted)]">
                (Uses coach's Calendly. Editable in admin.)
              </p>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={prevStep} className="btn-ghost flex-1">Back</button>
              <button onClick={handleFinishSetup} className="btn-primary flex-1">Finish setup</button>
            </div>
          </>
        )}
      </div>

      <p className="text-[10px] text-center text-[var(--muted)]">
        This is the guided onboarding wizard (step 2 from your feedback). 
        We can add the "three boxes" for First Class vs Coach ticket levels next.
      </p>
    </div>
  );
}

export default function OnboardingWizard() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto p-6 text-center">Loading onboarding wizard...</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
