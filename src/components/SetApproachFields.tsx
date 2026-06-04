"use client";

import SchemeVariantStep from "@/components/SchemeVariantStep";
import SetCountStep from "@/components/SetCountStep";
import StandardRepsStep from "@/components/StandardRepsStep";
import {
  SET_APPROACHES,
  WEIGHT_TIERS,
  approachNeedsReps,
  approachNeedsRepPattern,
  isValidSetCountForApproach,
  type SetApproachId,
  type WeightTierId,
} from "@/lib/workout-schemes";

function pickApproach(
  onApproach: (id: SetApproachId) => void,
  onClearSetCount: () => void,
  onClearVariant: () => void,
  onClearReps: () => void,
  setCount: number | "",
  id: SetApproachId,
) {
  onApproach(id);
  if (
    typeof setCount === "number" &&
    !isValidSetCountForApproach(setCount, id)
  ) {
    onClearSetCount();
  }
  if (!approachNeedsRepPattern(id)) onClearVariant();
  if (!approachNeedsReps(id)) onClearReps();
}

type Props = {
  approach: SetApproachId | "";
  repPattern: string;
  reps: string;
  setCount: number | "";
  weightTier: WeightTierId | "";
  onApproach: (id: SetApproachId) => void;
  onRepPattern: (id: string) => void;
  onReps: (reps: string) => void;
  onClearSetCount?: () => void;
  onSetCount: (count: number) => void;
  onWeightTier: (id: WeightTierId) => void;
  compact?: boolean;
};

export default function SetApproachFields({
  approach,
  repPattern,
  reps,
  setCount,
  weightTier,
  onApproach,
  onRepPattern,
  onReps,
  onClearSetCount,
  onSetCount,
  onWeightTier,
  compact = false,
}: Props) {
  const clearSetCount = onClearSetCount ?? (() => {});

  const variantReady =
    !approachNeedsRepPattern(approach) || !!repPattern;
  const repsReady = !approachNeedsReps(approach) || !!reps;
  const setCountReady =
    typeof setCount === "number" &&
    isValidSetCountForApproach(setCount, approach || null) &&
    variantReady &&
    repsReady;

  return (
    <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div>
        <p className="text-sm font-medium">Set approach</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Standard reps, drop sets with a rep ladder, rest pause with a dance
          count, and more.
        </p>
        <div
          className={`mt-3 grid gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}
        >
          {SET_APPROACHES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                approach === item.id
                  ? "chip-selected"
                  : "border-[var(--border)] chip-hover"
              }`}
              onClick={() =>
                pickApproach(
                  onApproach,
                  clearSetCount,
                  () => onRepPattern(""),
                  () => onReps(""),
                  setCount,
                  item.id,
                )
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {approach && approachNeedsReps(approach) && (
        <StandardRepsStep value={reps} onChange={onReps} />
      )}

      {approach && approachNeedsRepPattern(approach) && (
        <SchemeVariantStep
          approach={approach}
          value={repPattern}
          onChange={onRepPattern}
        />
      )}

      {approach && variantReady && repsReady && (
        <SetCountStep
          approach={approach}
          value={setCount}
          onChange={onSetCount}
          compact={compact}
        />
      )}

      {approach && setCountReady && (
        <div>
          <p className="text-sm font-medium">Starting weight tier</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Light, medium, or heavy — the default entry point for this exercise.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {WEIGHT_TIERS.map((tier) => (
              <button
                key={tier.id}
                type="button"
                className={`rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition ${
                  weightTier === tier.id
                    ? "chip-selected"
                    : "border-[var(--border)] chip-hover"
                }`}
                onClick={() => onWeightTier(tier.id)}
              >
                {tier.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}