/** Top-level how sets are programmed in a workout. */
export const SET_APPROACHES = [
  { id: "standard", label: "Standard sets" },
  { id: "drop_sets", label: "Drop sets" },
  { id: "rest_pause", label: "Rest pause sets" },
  { id: "positive", label: "Positive sets" },
  { id: "negative", label: "Negative sets" },
  { id: "timed", label: "Timed sets" },
] as const;

export type SetApproachId = (typeof SET_APPROACHES)[number]["id"];

/** Rep ladder inside a drop set (6-8-10, etc.). */
export const REP_LADDERS = [
  { id: "rep_6_8_10", label: "6-8-10" },
  { id: "rep_8_10_12", label: "8-10-12" },
  { id: "rep_12_10_8", label: "12-10-8" },
] as const;

export type RepLadderId = (typeof REP_LADDERS)[number]["id"];

/** Count / tempo style for rest-pause work. */
export const DANCE_COUNTS = [
  { id: "count_3_7", label: "3–7 count holds" },
  { id: "count_5_5", label: "5–5 count" },
] as const;

export type DanceCountId = (typeof DANCE_COUNTS)[number]["id"];

export type RepPatternId = RepLadderId | DanceCountId;

export const MAX_SET_COUNT = 10 as const;
export const MAX_REPS_PER_SET = 30 as const;

export const STANDARD_REP_PRESETS = [5, 8, 10, 12, 15, 20, 25, 30] as const;

export const WEIGHT_TIERS = [
  { id: "light", label: "Light weight" },
  { id: "medium", label: "Medium weight" },
  { id: "heavy", label: "Heavy weight" },
] as const;

export type WeightTierId = (typeof WEIGHT_TIERS)[number]["id"];

export const SET_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const TIMED_DURATION_MINUTES = [1, 2, 3, 4] as const;

export const TIMED_APPROACH_ID = "timed" as const;

/** @deprecated Use SET_APPROACHES — kept for imports during transition */
export const SET_SCHEMES = SET_APPROACHES;

/** @deprecated Use SetApproachId */
export type SetSchemeId = SetApproachId;

const LEGACY_SCHEME_MAP: Record<
  string,
  { approach: SetApproachId; repPattern?: RepPatternId | null }
> = {
  sets_1_5: { approach: "standard" },
  sets_10: { approach: "standard" },
  /** Maintain seed historically used this; treat as standard sets. */
  straight: { approach: "standard" },
  drop_sets: { approach: "drop_sets" },
  timed_sets: { approach: "timed" },
  drop: { approach: "drop_sets" },
  rep_6_8_10: { approach: "drop_sets", repPattern: "rep_6_8_10" },
  rep_8_10_12: { approach: "drop_sets", repPattern: "rep_8_10_12" },
  rep_12_10_8: { approach: "drop_sets", repPattern: "rep_12_10_8" },
  rest_pause_3_7: { approach: "rest_pause", repPattern: "count_3_7" },
  positive_3_7: { approach: "positive" },
  negative_3_7: { approach: "negative" },
};

export type NormalizedPrescription = {
  approach: SetApproachId;
  repPattern: RepPatternId | null;
  reps: string | null;
  sets: number | null;
};

export function normalizePrescription(input: {
  setScheme?: string | null;
  repPattern?: string | null;
  reps?: string | null;
  sets?: number | null;
}): NormalizedPrescription {
  const raw = input.setScheme ?? "standard";
  const legacy = LEGACY_SCHEME_MAP[raw];
  if (legacy) {
    return {
      approach: legacy.approach,
      repPattern: input.repPattern
        ? (input.repPattern as RepPatternId)
        : (legacy.repPattern ?? null),
      reps: input.reps ?? null,
      sets: input.sets ?? null,
    };
  }
  return {
    approach: raw as SetApproachId,
    repPattern: (input.repPattern as RepPatternId) ?? null,
    reps: input.reps ?? null,
    sets: input.sets ?? null,
  };
}

export function approachNeedsRepPattern(
  approach: string | null | undefined,
): boolean {
  return approach === "drop_sets" || approach === "rest_pause";
}

export function approachNeedsReps(approach: string | null | undefined): boolean {
  return approach === "standard";
}

export function isTimedApproach(
  approach: string | null | undefined,
): boolean {
  const normalized = normalizePrescription({ setScheme: approach });
  return normalized.approach === TIMED_APPROACH_ID;
}

/** @deprecated */
export function isTimedSetScheme(setScheme: string | null | undefined): boolean {
  return isTimedApproach(setScheme);
}

export function variantChoices(
  approach: string | null | undefined,
): readonly { id: string; label: string }[] {
  const { approach: a } = normalizePrescription({ setScheme: approach });
  if (a === "drop_sets") return REP_LADDERS;
  if (a === "rest_pause") return DANCE_COUNTS;
  return [];
}

export function variantStepLabel(approach: string | null | undefined): string {
  const { approach: a } = normalizePrescription({ setScheme: approach });
  if (a === "drop_sets") return "Rep pattern";
  if (a === "rest_pause") return "Dance count";
  if (a === "standard") return "Reps";
  return "Details";
}

export function variantFieldHint(approach: string | null | undefined): string {
  const { approach: a } = normalizePrescription({ setScheme: approach });
  if (a === "drop_sets") {
    return "The rep ladder members follow within each drop set round.";
  }
  if (a === "rest_pause") {
    return "The count rhythm for rest-pause work (the “dance count”).";
  }
  if (a === "standard") {
    return "How many reps per working set (e.g. 20 reps).";
  }
  return "";
}

export function repPatternLabel(id: string | null | undefined): string {
  if (!id) return "—";
  return (
    REP_LADDERS.find((r) => r.id === id)?.label ??
    DANCE_COUNTS.find((d) => d.id === id)?.label ??
    id
  );
}

export function setCountChoices(
  approach: string | null | undefined,
): readonly number[] {
  return isTimedApproach(approach) ? TIMED_DURATION_MINUTES : SET_COUNTS;
}

export function setCountStepLabel(approach: string | null | undefined): string {
  return isTimedApproach(approach) ? "Duration" : "Sets";
}

export function setCountFieldTitle(approach: string | null | undefined): string {
  return isTimedApproach(approach) ? "Duration" : "Number of sets";
}

export function setCountFieldHint(approach: string | null | undefined): string {
  return isTimedApproach(approach)
    ? "How long members perform this timed set (1–4 minutes)."
    : "How many working sets members will log (1–10).";
}

export function formatSetCountChoice(
  value: number,
  approach: string | null | undefined,
): string {
  if (isTimedApproach(approach)) {
    return value === 1 ? "1 min" : `${value} min`;
  }
  return String(value);
}

export function isValidSetCountForApproach(
  count: number,
  approach: string | null | undefined,
): boolean {
  return setCountChoices(approach).includes(count);
}

export function setCountLabel(
  count: number | null | undefined,
  approach?: string | null,
): string {
  if (count == null || count < 1) return "—";
  if (isTimedApproach(approach)) {
    return count === 1 ? "1 minute" : `${count} minutes`;
  }
  return count === 1 ? "1 set" : `${count} sets`;
}

export function approachLabel(id: string | null | undefined): string {
  const { approach } = normalizePrescription({ setScheme: id });
  return SET_APPROACHES.find((s) => s.id === approach)?.label ?? id ?? "—";
}

/** @deprecated Use approachLabel */
export function setSchemeLabel(id: string | null | undefined): string {
  return approachLabel(id);
}

export function weightTierLabel(id: string | null | undefined): string {
  return WEIGHT_TIERS.find((t) => t.id === id)?.label ?? id ?? "—";
}

export function formatPrescriptionSummary(opts: {
  setScheme?: string | null;
  repPattern?: string | null;
  reps?: string | null;
  sets?: number | null;
}): string {
  const p = normalizePrescription(opts);
  const parts: string[] = [];

  if (p.approach === "standard") {
    if (p.sets != null) parts.push(setCountLabel(p.sets, p.approach));
    if (p.reps) parts.push(`${p.reps} reps`);
    return parts.length ? parts.join(" × ") : approachLabel(p.approach);
  }

  if (p.approach === "drop_sets") {
    parts.push("Drop sets");
    if (p.repPattern) parts.push(repPatternLabel(p.repPattern));
    if (p.sets != null) parts.push(setCountLabel(p.sets, p.approach));
    return parts.join(" · ");
  }

  if (p.approach === "rest_pause") {
    parts.push("Rest pause");
    if (p.repPattern) parts.push(repPatternLabel(p.repPattern));
    if (p.sets != null) parts.push(setCountLabel(p.sets, p.approach));
    return parts.join(" · ");
  }

  if (p.approach === "positive" || p.approach === "negative") {
    const label = approachLabel(p.approach);
    const count =
      p.sets != null ? ` · ${setCountLabel(p.sets, p.approach)}` : "";
    return `${label} · 3–7 count${count}`;
  }

  if (p.approach === "timed" && p.sets != null) {
    return `${approachLabel(p.approach)} · ${setCountLabel(p.sets, p.approach)}`;
  }

  return approachLabel(p.approach);
}

export function prescriptionSteps(approach: SetApproachId): readonly string[] {
  switch (approach) {
    case "standard":
      return ["approach", "reps", "sets", "weight", "notes"];
    case "drop_sets":
    case "rest_pause":
      return ["approach", "variant", "sets", "weight", "notes"];
    case "positive":
    case "negative":
      return ["approach", "sets", "weight", "notes"];
    case "timed":
      return ["approach", "sets", "weight", "notes"];
    default:
      return ["approach", "sets", "weight", "notes"];
  }
}

export function isPrescriptionComplete(opts: {
  approach: SetApproachId;
  repPattern?: string | null;
  reps?: string | null;
  sets?: number | null;
}): boolean {
  if (opts.sets == null || !isValidSetCountForApproach(opts.sets, opts.approach)) {
    return false;
  }
  if (opts.approach === "standard") {
    const n = Number(opts.reps);
    return (
      !!opts.reps &&
      Number.isFinite(n) &&
      (STANDARD_REP_PRESETS as readonly number[]).includes(n)
    );
  }
  if (opts.approach === "drop_sets") {
    return REP_LADDERS.some((r) => r.id === opts.repPattern);
  }
  if (opts.approach === "rest_pause") {
    return DANCE_COUNTS.some((d) => d.id === opts.repPattern);
  }
  return true;
}

export function formatPastPerformance(opts: {
  weightTier: string;
  setScheme: string;
  repPattern?: string | null;
  reps?: string | null;
  sets?: number | null;
  startingWeightLbs: number | null;
  performedAt?: Date | string;
}): string {
  const prescription = formatPrescriptionSummary(opts).toLowerCase();
  const weight =
    opts.startingWeightLbs != null
      ? `starting at ${opts.startingWeightLbs} lbs`
      : "weight not logged";
  const when = opts.performedAt
    ? ` · ${new Date(opts.performedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "";
  return `Last time you did ${weightTierLabel(opts.weightTier).toLowerCase()} — ${prescription}, ${weight}${when}`;
}

export const ALL_REP_PATTERN_IDS = [
  ...REP_LADDERS.map((r) => r.id),
  ...DANCE_COUNTS.map((d) => d.id),
] as const;