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
  normalizePrescription,
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

  const [approach, setApproach] = useState<SetApproachId>(initial.approach ?? "standard");
  const [repPattern, setRepPattern] = useState<string | null>(initial.repPattern);
  const [reps, setReps] = useState<string>(initial.reps ?? "");
  const [setCount, setSetCount] = useState<number | null>(initial.sets);
  const [weightTier, setWeightTier] = useState<WeightTierId | null>(initialTier ?? null);
  const [notes, setNotes] = useState(initialNotes ?? "");

  const summary = useMemo(() => {
    if (setCount == null) return null;
    return formatPrescriptionSummary({
      setScheme: approach,
      repPattern,
      reps: reps || null,
      sets: setCount,
    });
  }, [approach, repPattern, reps, setCount]);

  const canSubmit =
    !!weightTier &&
    setCount != null &&
    isPrescriptionComplete({
      approach,
      repPattern,
      reps: reps || null,
      sets: setCount,
    });

  function handleApproachChange(id: SetApproachId) {
    setApproach(id);
    if (!approachNeedsRepPattern(id)) setRepPattern(null);
    if (!approachNeedsReps(id)) setReps("");
  }

  function submit() {
    if (!canSubmit || !weightTier || setCount == null) return;
    onConfirm({
      setScheme: approach,
      repPattern: approachNeedsRepPattern(approach) ? repPattern : null,
      reps: approachNeedsReps(approach) ? reps : null,
      setCount,
      weightTier,
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
            Configure exercise
          </p>
          <h3 className="text-lg font-semibold">{exerciseName}</h3>
        </div>
        {summary && weightTier && (
          <p className="rounded-lg bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--muted)]">
            <span className="font-medium text-[var(--text)]">{summary}</span>
            {" · "}
            {WEIGHT_TIERS.find((t) => t.id === weightTier)?.label}
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Approach</span>
          <select
            className="input mt-1.5"
            value={approach}
            onChange={(e) => handleApproachChange(e.target.value as SetApproachId)}
          >
            {SET_APPROACHES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {approachNeedsReps(approach) && (
          <div>
            <StandardRepsStep value={reps} onChange={setReps} />
          </div>
        )}

        {approachNeedsRepPattern(approach) && (
          <div>
            <SchemeVariantStep
              approach={approach}
              value={repPattern ?? ""}
              onChange={setRepPattern}
            />
          </div>
        )}

        <div>
          <SetCountStep approach={approach} value={setCount ?? ""} onChange={setSetCount} />
        </div>

        <label className="block text-sm">
          <span className="font-medium">Weight tier</span>
          <select
            className="input mt-1.5"
            value={weightTier ?? ""}
            onChange={(e) => setWeightTier(e.target.value as WeightTierId)}
          >
            <option value="">Select…</option>
            {WEIGHT_TIERS.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block text-sm">
        <span className="font-medium">Coaching notes</span>
        <span className="ml-1 text-xs font-normal text-[var(--muted)]">(optional)</span>
        <textarea
          className="input mt-1.5 min-h-[72px] resize-y"
          placeholder="Setup, cues, tempo…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn-primary" disabled={!canSubmit} onClick={submit}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}