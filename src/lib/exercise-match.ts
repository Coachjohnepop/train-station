import { canonicalExerciseName, normalizeExerciseKey } from "@/lib/exercise-canonical";

export type ExerciseCatalogEntry = {
  id: string;
  name: string;
  videoUrl?: string | null;
  description?: string | null;
  tags?: string | string[] | null;
};

/** SMS block name → preferred catalog name substring (longest wins). */
const SMS_EXERCISE_ALIASES: Record<string, string> = {
  "dumbbell bicep curls": "supinated bicep curl",
  "dumbbell shoulder press": "standing dumbbell shoulder press",
  "air squats": "air squat",
  "leg press": "leg press machine",
  "barbell hip thrust raise": "hip thrust",
  "barbell hip thrust": "hip thrust",
  "barbell hip thrust back on bench hold at top of squeeze": "hip thrust",
  "seated calve raises": "seated calve raise",
  "seated calf raises": "seated calve raise",
  "standing calf raises": "standing calve raise",
  "standing calve raises": "standing calve raise",
  "dumbbell bulgarian split squats": "bulgarian split squat",
  "dumbbell bulgarians split squats": "bulgarian split squat",
  "hiit jump squats to finish": "jump squat",
  "hiit jump squats": "jump squat",
  "stretch well": "cool down stretch",
  stretch: "cool down stretch",
  "cool down": "cool down stretch",
  "warm up": "warmup",
};

export function sanitizeSmsExerciseName(name: string): string {
  return canonicalExerciseName(name);
}

export function normalizeExerciseName(s: string): string {
  return normalizeExerciseKey(sanitizeSmsExerciseName(s));
}

function aliasTarget(normalized: string): string | null {
  if (SMS_EXERCISE_ALIASES[normalized]) return SMS_EXERCISE_ALIASES[normalized];
  let best: string | null = null;
  let bestLen = 0;
  for (const [key, target] of Object.entries(SMS_EXERCISE_ALIASES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      if (key.length > bestLen) {
        bestLen = key.length;
        best = target;
      }
    }
  }
  return best;
}

function meaningfulWords(s: string): string[] {
  return s.split(" ").filter((w) => w.length > 2 && !/^\d+$/.test(w));
}

function scoreMatch(target: string, candidate: string): number {
  const tWords = meaningfulWords(target);
  const cWords = meaningfulWords(candidate);
  if (tWords.length === 0) return 0;

  let score = 0;
  for (const tw of tWords) {
    if (candidate.includes(tw)) score += 2;
  }

  // Never use military press terminology
  if (candidate.includes("military")) score -= 50;

  // Penalize wrong movement family
  if (target.includes("leg press") && candidate.includes("hack squat")) score -= 20;
  if (target.includes("leg press") && candidate.includes("chest")) score -= 10;
  if (target.includes("hip thrust") && candidate.includes("chest")) score -= 10;
  if (target.includes("bicep") && !candidate.includes("bicep") && !candidate.includes("curl")) {
    score -= 3;
  }
  if (target.includes("shoulder press") && candidate.includes("sitting") && target.includes("standing")) {
    score += 4;
  }
  if (target.includes("shoulder press") && candidate.includes("sitting")) {
    score -= 2;
  }
  if (target.includes("shoulder press") && candidate.includes("standing")) {
    score += 3;
  }
  if (target.includes("seated") && candidate.includes("standing") && !candidate.includes("seated")) {
    score -= 5;
  }
  if (target.includes("seated") && candidate.includes("seated")) {
    score += 4;
  }

  if (candidate.includes(target) || target.includes(candidate)) score += 3;

  const overlap = tWords.filter((w) => cWords.some((cw) => cw.includes(w) || w.includes(cw))).length;
  score += overlap;

  return score;
}

export function matchExerciseInCatalog(
  rawName: string,
  exercises: ExerciseCatalogEntry[],
): ExerciseCatalogEntry | null {
  const sanitized = sanitizeSmsExerciseName(rawName);
  const normalized = normalizeExerciseName(sanitized);
  if (!normalized) return null;

  const exact = exercises.find((e) => normalizeExerciseName(e.name) === normalized);
  if (exact) return exact;

  const alias = aliasTarget(normalized);
  const searchKey = alias ? normalizeExerciseName(alias) : normalized;

  let best: ExerciseCatalogEntry | null = null;
  let bestScore = 0;

  for (const ex of exercises) {
    const en = normalizeExerciseName(ex.name);
    const s = scoreMatch(searchKey, en);
    if (s > bestScore) {
      bestScore = s;
      best = ex;
    }
  }

  const minScore = Math.max(
    3,
    Math.min(4, meaningfulWords(searchKey).filter((w) => w.length > 3).length * 2),
  );
  return bestScore >= minScore ? best : null;
}