"use client";

import { useMemo, useState } from "react";
import SchemeVariantStep from "@/components/SchemeVariantStep";
import SetCountStep from "@/components/SetCountStep";
import StandardRepsStep from "@/components/StandardRepsStep";
import {
  SET_APPROACHES,
  WEIGHT_TIERS,
  approachNeedsReps,
  approachNeedsRepPattern,
  formatPrescriptionSummary,
  isPrescriptionComplete,
  isValidSetCountForApproach,
  normalizePrescription,
  prescriptionSteps,
  setCountStepLabel,
  variantStepLabel,
  type SetApproachId,
  type WeightTierId,
} from "@/lib/workout-schemes";

export type WorkoutExerciseConfig = {
  setScheme: SetApproachId;
  repPattern: string | null;
  reps: string | null;
  setCount: number;
  weightTier: WeightTierId;
  notes: string | null;
};

type Props = {
  exerciseName: string;
  onConfirm: (config: WorkoutExerciseConfig) => void;
  onCancel: () => void;
  initialScheme?: string | null;
  initialRepPattern?: string | null;
  initialReps?: string | null;
  initialSetCount?: number | null;
  initialTier?: WeightTierId | null;
  initialNotes?: string | null;
  confirmLabel?: string;
};

type StepKey = "approach" | "variant" | "reps" | "sets" | "weight" | "notes";

export default function ExerciseCascadePicker({
  exerciseName,
  onConfirm,
  onCancel,
  initialScheme,
  initialRepPattern,
  initialReps,
  initialSetCount,
  initialTier,
  initialNotes,
  confirmLabel = "Add to workout",
}: Props) {
  const initial = normalizePrescription({
    setScheme: initialScheme,
    repPattern: initialRepPattern,
    reps: initialReps,
    sets: initialSetCount,
  });

  const [approach, setApproach] = useState<SetApproachId | null>(
    initial.approach ?? null,
  );
  const [repPattern, setRepPattern] = useState<string | null>(
    initial.repPattern,
  );
  const [reps, setReps] = useState<string>(initial.reps ?? "");
  const [setCount, setSetCount] = useState<number | null>(initial.sets);
  const [weightTier, setWeightTier] = useState<WeightTierId | null>(
    initialTier ?? null,
  );
  const [notes, setNotes] = useState(initialNotes ?? "");

  const steps = useMemo(
    () => (approach ? prescriptionSteps(approach) : ["approach"]),
    [approach],
  );

  const [stepIndex, setStepIndex] = useState(() => {
    if (!approach) return 0;
    if (
      isPrescriptionComplete({
        approach,
        repPattern,
        reps: reps || null,
        sets: setCount,
      }) &&
      weightTier
    ) {
      return steps.length - 1;
    }
    if (weightTier && setCount != null) {
      return Math.max(0, steps.indexOf("weight"));
    }
    if (setCount != null) {
      const setsIdx = steps.indexOf("sets");
      return setsIdx >= 0 ? setsIdx + 1 : 0;
    }
    if (approach === "standard" && reps) {
      return steps.indexOf("sets");
    }
    if (repPattern && approachNeedsRepPattern(approach)) {
      return steps.indexOf("sets");
    }
    if (approach) return 1;
    return 0;
  });

  const currentStep = (steps[stepIndex] ?? "approach") as StepKey;

  function selectApproach(id: SetApproachId) {
    setApproach(id);
    if (setCount != null && !isValidSetCountForApproach(setCount, id)) {
      setSetCount(null);
    }
    if (!approachNeedsRepPattern(id)) setRepPattern(null);
    if (!approachNeedsReps(id)) setReps("");
  }

  function stepDone(key: StepKey): boolean {
    if (!approach) return key !== "approach";
    switch (key) {
      case "approach":
        return !!approach;
      case "variant":
        return !!repPattern;
      case "reps":
        return !!reps;
      case "sets":
        return setCount != null;
      case "weight":
        return !!weightTier;
      case "notes":
        return !!notes.trim();
      default:
        return false;
    }
  }

  function canAdvanceFrom(step: StepKey): boolean {
    switch (step) {
      case "approach":
        return !!approach;
      case "variant":
        return !!repPattern;
      case "reps":
        return !!reps;
      case "sets":
        return setCount != null;
      case "weight":
        return !!weightTier;
      default:
        return true;
    }
  }

  function goNext() {
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  function submit() {
    if (
      approach &&
      setCount != null &&
      weightTier &&
      isPrescriptionComplete({
        approach,
        repPattern,
        reps: reps || null,
        sets: setCount,
      })
    ) {
      onConfirm({
        setScheme: approach,
        repPattern: approachNeedsRepPattern(approach) ? repPattern : null,
        reps: approachNeedsReps(approach) ? reps : null,
        setCount,
        weightTier,
        notes: notes.trim() || null,
      });
    }
  }

  const summary =
    approach &&
    formatPrescriptionSummary({
      setScheme: approach,
      repPattern,
      reps: reps || null,
      sets: setCount,
    });

  const stepLabels: Record<StepKey, string> = {
    approach: "Approach",
    variant: approach ? variantStepLabel(approach) : "Pattern",
    reps: "Reps",
    sets: approach ? setCountStepLabel(approach) : "Sets",
    weight: "Weight",
    notes: "Notes",
  };

  return (
    <div className="card card-accent-frame">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        Configure for this workout
      </p>
      <h3 className="mt-1 text-lg font-semibold">{exerciseName}</h3>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        {steps.map((key, i) => (
          <span key={key} className="inline-flex items-center gap-2">
            {i > 0 && <span className="text-[var(--muted)]">→</span>}
            <StepBadge
              n={i + 1}
              label={stepLabels[key as StepKey]}
              active={stepIndex === i}
              done={stepDone(key as StepKey) && stepIndex !== i}
            />
          </span>
        ))}
      </div>

      {currentStep === "approach" && (
        <div className="mt-4">
          <p className="text-sm text-[var(--muted)]">
            How is this movement programmed in this workout?
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SET_APPROACHES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  approach === item.id
                    ? "chip-selected text-[var(--text)]"
                    : "border-[var(--border)] chip-hover"
                }`}
                onClick={() => selectApproach(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <NavRow
            onCancel={onCancel}
            nextLabel={
              approach
                ? `Next: ${stepLabels[steps[1] as StepKey]?.toLowerCase() ?? "details"} →`
                : "Next →"
            }
            nextDisabled={!canAdvanceFrom("approach")}
            onNext={goNext}
          />
        </div>
      )}

      {currentStep === "variant" && approach && (
        <div className="mt-4">
          <SchemeVariantStep
            approach={approach}
            value={repPattern ?? ""}
            onChange={setRepPattern}
          />
          <NavRow onBack={goBack} onCancel={onCancel} onNext={goNext} nextDisabled={!repPattern} />
        </div>
      )}

      {currentStep === "reps" && approach && (
        <div className="mt-4">
          <StandardRepsStep value={reps} onChange={setReps} />
          <NavRow onBack={goBack} onCancel={onCancel} onNext={goNext} nextDisabled={!reps} />
        </div>
      )}

      {currentStep === "sets" && approach && (
        <div className="mt-4">
          <SetCountStep
            approach={approach}
            value={setCount ?? ""}
            onChange={setSetCount}
          />
          <NavRow
            onBack={goBack}
            onCancel={onCancel}
            onNext={goNext}
            nextDisabled={setCount == null}
          />
        </div>
      )}

      {currentStep === "weight" && (
        <div className="mt-4">
          <p className="text-sm text-[var(--muted)]">
            Starting with light, medium, or heavy weight?
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {WEIGHT_TIERS.map((tier) => (
              <button
                key={tier.id}
                type="button"
                className={`rounded-lg border px-3 py-3 text-center text-sm font-medium transition ${
                  weightTier === tier.id
                    ? "chip-selected"
                    : "border-[var(--border)] chip-hover"
                }`}
                onClick={() => setWeightTier(tier.id)}
              >
                {tier.label}
              </button>
            ))}
          </div>
          {summary && (
            <p className="mt-3 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
              <strong className="text-[var(--text)]">{summary}</strong>
            </p>
          )}
          <NavRow
            onBack={goBack}
            onCancel={onCancel}
            onNext={goNext}
            nextDisabled={!weightTier}
            nextLabel="Next: coaching notes →"
          />
        </div>
      )}

      {currentStep === "notes" && (
        <div className="mt-4">
          <p className="text-sm font-medium">Coaching notes</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Setup, cues, tempo, or safety — shown to members during this workout.
            Optional.
          </p>
          <textarea
            className="input mt-3 min-h-[100px] resize-y"
            placeholder="e.g. Brace core, sit hips back, knees track over toes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {summary && weightTier && (
            <p className="mt-3 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
              <strong className="text-[var(--text)]">{summary}</strong> ·{" "}
              {WEIGHT_TIERS.find((t) => t.id === weightTier)?.label}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={goBack}>
              ← Back
            </button>
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={
                !approach ||
                setCount == null ||
                !weightTier ||
                !isPrescriptionComplete({
                  approach,
                  repPattern,
                  reps: reps || null,
                  sets: setCount,
                })
              }
              onClick={submit}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavRow({
  onBack,
  onCancel,
  onNext,
  nextDisabled,
  nextLabel = "Next →",
}: {
  onBack?: () => void;
  onCancel: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {onBack && (
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Back
        </button>
      )}
      <button type="button" className="btn-ghost" onClick={onCancel}>
        Cancel
      </button>
      <button
        type="button"
        className="btn-primary"
        disabled={nextDisabled}
        onClick={onNext}
      >
        {nextLabel}
      </button>
    </div>
  );
}

function StepBadge({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${
        active ? "step-badge-active" : "text-[var(--muted)]"
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
          done
            ? "bg-[var(--success)] text-zinc-900"
            : active
              ? "step-badge-dot-active"
              : "bg-[var(--border)]"
        }`}
      >
        {done && !active ? "✓" : n}
      </span>
      {label}
    </span>
  );
}