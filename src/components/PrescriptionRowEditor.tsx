"use client";

import { useMemo, useState } from "react";
import {
  PATTERN_TYPE_LABELS,
  PRESCRIPTION_PATTERN_TYPES,
  type PrescriptionDraft,
  type PrescriptionPatternType,
} from "@/lib/prescription-example-types";
import { buildPrescriptionSummary } from "@/lib/prescription-example-summary";
import { WEIGHT_TIERS, type WeightTierId } from "@/lib/workout-schemes";

type Props = {
  exerciseName: string;
  initial: Omit<PrescriptionDraft, "sampleExercise"> & { sampleExercise?: string };
  onConfirm: (draft: PrescriptionDraft & { summary: string }) => void;
  onCancel: () => void;
  confirmLabel?: string;
  allowPatternChange?: boolean;
};

const SET_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const REP_PRESETS = [5, 8, 10, 12, 15, 20, 25, 30] as const;
const HOLD_PRESETS = [10, 15, 20, 30, 45, 60] as const;
const REST_PRESETS = [60, 90, 120] as const;

function patternUsesPhase2(pattern: PrescriptionPatternType): boolean {
  return ["hold_burnout", "hold_fixed_reps", "hold_then_timed"].includes(pattern);
}

function patternUsesPhase1(pattern: PrescriptionPatternType): boolean {
  return pattern !== "burnout_only";
}

export default function PrescriptionRowEditor({
  exerciseName,
  initial,
  onConfirm,
  onCancel,
  confirmLabel = "Save",
  allowPatternChange = true,
}: Props) {
  const [patternType, setPatternType] = useState<PrescriptionPatternType>(
    initial.patternType ?? "standard_reps",
  );
  const [setCount, setSetCount] = useState(initial.setCount ?? 3);
  const [restBetweenSetsSec, setRestBetweenSetsSec] = useState(
    initial.restBetweenSetsSec ?? 90,
  );
  const [weightTier, setWeightTier] = useState<WeightTierId>(
    (initial.weightTier as WeightTierId) || "medium",
  );
  const [phase1DurationSec, setPhase1DurationSec] = useState<number | null>(
    initial.phase1DurationSec ?? null,
  );
  const [phase1Reps, setPhase1Reps] = useState<number | null>(initial.phase1Reps ?? 10);
  const [phase1PositionCue, setPhase1PositionCue] = useState(
    initial.phase1PositionCue ?? "",
  );
  const [phase2DurationSec, setPhase2DurationSec] = useState<number | null>(
    initial.phase2DurationSec ?? null,
  );
  const [phase2Reps, setPhase2Reps] = useState<number | null>(initial.phase2Reps ?? null);
  const [notes, setNotes] = useState(initial.notes ?? "");

  const summary = useMemo(() => {
    const draft = {
      id: initial.id,
      patternType,
      sampleExercise: exerciseName,
      setCount,
      restBetweenSetsSec,
      weightTier,
      phase1Type: phase1TypeForPattern(patternType),
      phase1DurationSec,
      phase1Reps,
      phase1RepKind: phase1RepKindForPattern(patternType),
      phase1PositionCue,
      phase2Type: phase2TypeForPattern(patternType),
      phase2DurationSec,
      phase2Reps,
      phase2RepKind: phase2RepKindForPattern(patternType),
      phase2PositionCue: "",
      notes,
      summary: "",
    };
    return buildPrescriptionSummary(draft);
  }, [
    patternType,
    setCount,
    restBetweenSetsSec,
    weightTier,
    phase1DurationSec,
    phase1Reps,
    phase1PositionCue,
    phase2DurationSec,
    phase2Reps,
    notes,
    exerciseName,
    initial.id,
  ]);

  function submit() {
    const draft = {
      id: initial.id,
      patternType,
      sampleExercise: exerciseName,
      setCount,
      restBetweenSetsSec,
      weightTier,
      phase1Type: phase1TypeForPattern(patternType),
      phase1DurationSec,
      phase1Reps,
      phase1RepKind: phase1RepKindForPattern(patternType),
      phase1PositionCue,
      phase2Type: phase2TypeForPattern(patternType),
      phase2DurationSec,
      phase2Reps,
      phase2RepKind: phase2RepKindForPattern(patternType),
      phase2PositionCue: "",
      notes,
      summary,
    };
    onConfirm(draft);
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{exerciseName}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{summary}</p>
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          {allowPatternChange ? (
            <label className="block text-sm">
              <span className="font-medium">Pattern</span>
              <select
                className="input mt-1"
                value={patternType}
                onChange={(e) => setPatternType(e.target.value as PrescriptionPatternType)}
              >
                {PRESCRIPTION_PATTERN_TYPES.map((id) => (
                  <option key={id} value={id}>
                    {PATTERN_TYPE_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm">
              <span className="font-medium">Pattern:</span>{" "}
              <span className="text-[var(--muted)]">{PATTERN_TYPE_LABELS[patternType]}</span>
            </p>
          )}

          <div>
            <p className="text-sm font-medium">Sets</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SET_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`coach-floor-set-btn min-w-[2.25rem] ${setCount === n ? "ring-2 ring-accent" : ""}`}
                  onClick={() => setSetCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Rest between sets</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {REST_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn-ghost px-3 py-1.5 text-sm ${restBetweenSetsSec === n ? "ring-2 ring-accent" : ""}`}
                  onClick={() => setRestBetweenSetsSec(n)}
                >
                  {n}s
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Weight</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {WEIGHT_TIERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`btn-ghost px-3 py-1.5 text-sm ${weightTier === t.id ? "ring-2 ring-accent" : ""}`}
                  onClick={() => setWeightTier(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {patternUsesPhase1(patternType) && (
          <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Phase 1
            </p>
            {patternType === "standard_reps" || patternType === "max_reps" ? (
              <div>
                <p className="text-sm font-medium">
                  {patternType === "max_reps" ? "Max reps cap" : "Reps per set"}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {REP_PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`coach-floor-set-btn min-w-[2.25rem] ${phase1Reps === n ? "ring-2 ring-accent" : ""}`}
                      onClick={() => setPhase1Reps(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {["hold_burnout", "hold_fixed_reps", "hold_only", "hold_then_timed"].includes(
              patternType,
            ) ? (
              <>
                <div>
                  <p className="text-sm font-medium">Hold (seconds)</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {HOLD_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`coach-floor-set-btn min-w-[2.25rem] ${phase1DurationSec === n ? "ring-2 ring-accent" : ""}`}
                        onClick={() => setPhase1DurationSec(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block text-sm">
                  <span className="font-medium">Position cue</span>
                  <input
                    className="input mt-1"
                    value={phase1PositionCue}
                    onChange={(e) => setPhase1PositionCue(e.target.value)}
                    placeholder="e.g. bottom of lift"
                  />
                </label>
              </>
            ) : null}

            {patternType === "timed_rounds" ? (
              <div>
                <p className="text-sm font-medium">Work interval (seconds)</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[15, 20, 30, 40, 45, 60].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`coach-floor-set-btn min-w-[2.25rem] ${phase1DurationSec === n ? "ring-2 ring-accent" : ""}`}
                      onClick={() => setPhase1DurationSec(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {patternUsesPhase2(patternType) && (
          <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Phase 2
            </p>
            {patternType === "hold_burnout" ? (
              <p className="text-sm text-[var(--muted)]">Burnout reps to fatigue</p>
            ) : null}
            {patternType === "hold_fixed_reps" ? (
              <div>
                <p className="text-sm font-medium">Reps after hold</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[3, 5, 8, 10, 12, 15].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`coach-floor-set-btn min-w-[2.25rem] ${phase2Reps === n ? "ring-2 ring-accent" : ""}`}
                      onClick={() => setPhase2Reps(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {patternType === "hold_then_timed" ? (
              <div>
                <p className="text-sm font-medium">Timed work (seconds)</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[15, 20, 30, 40, 45].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`coach-floor-set-btn min-w-[2.25rem] ${phase2DurationSec === n ? "ring-2 ring-accent" : ""}`}
                      onClick={() => setPhase2DurationSec(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="space-y-3">
          <label className="block text-sm">
            <span className="font-medium">Coach notes</span>
            <textarea
              className="input mt-1 min-h-[5rem]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional cues for Jeremy or members"
            />
          </label>
          <p className="text-xs text-[var(--muted)]">
            Need another view later? We add a column to the right — same row, same edit flow.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
        <button type="button" className="btn-primary" onClick={submit}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

function phase1TypeForPattern(pattern: PrescriptionPatternType) {
  if (pattern === "standard_reps" || pattern === "max_reps") return "reps" as const;
  if (pattern === "timed_rounds") return "timed" as const;
  if (pattern === "burnout_only") return "burnout" as const;
  if (["hold_burnout", "hold_fixed_reps", "hold_only", "hold_then_timed"].includes(pattern)) {
    return "hold" as const;
  }
  return "" as const;
}

function phase2TypeForPattern(pattern: PrescriptionPatternType) {
  if (pattern === "hold_burnout" || pattern === "burnout_only") return "burnout" as const;
  if (pattern === "hold_fixed_reps") return "reps" as const;
  if (pattern === "hold_then_timed") return "timed" as const;
  return "" as const;
}

function phase1RepKindForPattern(pattern: PrescriptionPatternType) {
  if (pattern === "max_reps") return "max" as const;
  if (pattern === "standard_reps") return "fixed" as const;
  return "" as const;
}

function phase2RepKindForPattern(pattern: PrescriptionPatternType) {
  if (pattern === "hold_burnout") return "burnout" as const;
  if (pattern === "hold_fixed_reps") return "fixed" as const;
  return "" as const;
}