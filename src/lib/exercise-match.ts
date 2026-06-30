export type ExerciseCatalogEntry = {
  id: string;
  name: string;
  videoUrl?: string | null;
  description?: string | null;
  tags?: string | string[] | null;
};

/** SMS block name → preferred catalog name substring (longest wins). */
const SMS_EXERCISE_ALIASES: Record<string, string> = {
  "dumbbell bicep curls": "bicep curl",
  "dumbbell shoulder press": "shoulder press",
  "air squats": "air squat",
  "leg press": "hack squat",
  "barbell hip thrust raise": "hip thrust",
  "barbell hip thrust": "hip thrust",
  "seated calf raises": "calve raise",
  "standing calf raises": "calve raise",
  "dumbbell bulgarian split squats": "bulgarian",
  "hiit jump squats to finish": "jump squat",
  "hiit jump squats": "jump squat",
  "stretch well": "cool down stretch",
  "cool down": "cool down stretch",
  "warm up": "warmup",
};

export function sanitizeSmsExerciseName(name: string): string {
  let s = name.trim();
  s = s.replace(/\s+\d+\s*$/i, ""); // trailing " 20"
  s = s.replace(/^\d+\s+/i, ""); // leading "25 "
  s = s.replace(/\s+x\s+\d+\s*sets?$/i, "");
  s = s.replace(/\s+\d+\s*sets?$/i, "");
  return s.trim();
}

export function normalizeExerciseName(s: string): string {
  return sanitizeSmsExerciseName(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function aliasTarget(normalized: string): string | null {
  if (SMS_EXERCISE_ALIASES[normalized]) return SMS_EXERCISE_ALIASES[normalized];
  for (const [key, target] of Object.entries(SMS_EXERCISE_ALIASES)) {
    if (normalized.includes(key) || key.includes(normalized)) return target;
  }
  return null;
}

function scoreMatch(target: string, candidate: string): number {
  const tWords = target.split(" ").filter((w) => w.length > 2);
  const cWords = candidate.split(" ").filter((w) => w.length > 2);
  if (tWords.length === 0) return 0;

  let score = 0;
  for (const tw of tWords) {
    if (candidate.includes(tw)) score += 2;
  }

  // Penalize wrong movement family
  if (target.includes("leg press") && candidate.includes("chest")) score -= 10;
  if (target.includes("hip thrust") && candidate.includes("chest")) score -= 10;
  if (target.includes("bicep") && !candidate.includes("bicep") && !candidate.includes("curl")) {
    score -= 3;
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

  const minScore = Math.max(3, Math.min(4, searchKey.split(" ").filter((w) => w.length > 3).length * 2));
  return bestScore >= minScore ? best : null;
}