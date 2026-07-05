/**
 * Canonical exercise names — movement identity only.
 * Reps, sets, and coaching notes belong on WorkoutExercise, not Exercise.name.
 */

export type ExtractedPrescription = {
  sets?: number;
  reps?: string;
  notes?: string;
};

const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const ACRONYMS = new Set(["hiit", "rdl", "sms"]);

/** Coaching-line imports that are not real exercises → canonical movement name. */
const EXPLICIT_CANONICAL: Record<string, string> = {
  "choose between": "Band Lat Pull Downs",
  "find an anchor to use": "Band Lat Pull Downs",
  "double arm": "Double Arm Bicep Curls",
  alternatings: "Alternating Step Back Lunges",
  alternating: "Alternating Step Back Lunges",
  "straight leg": "Straight Leg Abdominal Crunches",
  "light band": "Band Lat Pull Downs",
  "supinated grip": "Seated Double Arm Supinated Bicep Curls",
  "both arms at the same time": "Double Arm Bicep Curls",
  "elbow under wrist": "Dumbbell Flat Bench Chest Press",
  "two dumbbells": "Dumbbell Shoulder Press",
  "same leg though all steps": "Step Ups",
  "knee and hand on bench or chair": "Single Arm Dumbbell Bent Over Row",
  "seated position": "Seated Double Arm Supinated Bicep Curls",
  "for the start of week": "General Warm Up + Shoulder Mobility",
  "increase weight from last week": "General Warm Up + Shoulder Mobility",
  "anchor overhead or lay on ground and anchor": "Band Lat Pull Downs",
  "anchor bands overhead or laying on back": "Band Lat Pull Downs",
  "or laying on back bands with handles lat pull overs": "Band Lat Pull Downs",
  "laying on a flat bench or on the ground": "Dumbbell Flat Bench Chest Press",
  "laying on side": "Lateral Leg Raises",
  "laying on your side": "Lateral Leg Raises",
  "laying on your side lateral leg raises no resistance": "Lateral Leg Raises",
  "pronated grip double arm tricep extensions": "Double Arm Dumbbell Tricep Extensions",
  "cable lat pull downs with": "Cable Lat Pull Downs",
  "standing straight bar cable back": "Standing Back Row",
  "standing angle bar cable tricep": "Standing Straight Bar Cable Tricep Extensions",
  "dumbbell bent over row hand": "Dumbbell Bent Over Row",
  "dumbbell bent over row knee": "Dumbbell Bent Over Row",
  "single leg pistol squat from": "Single Leg Pistol Squat",
  "dumbbell goblet squats hold by": "Goblet Squat",
  "dumbbell goblet squats 15 15 15 3": "Goblet Squat",
  "incline keep heartrate under 140bpm": "Low Intensity Cardio Warmup",
  "warm up well 5 min bike": "Low Intensity Cardio Warmup",
  "shoulder mobility warm": "General Warm Up + Shoulder Mobility",
  "upper body warm up": "General Warm Up + Shoulder Mobility",
  "so isolation core work": "Abdominal Planks",
  "day 3 workout gym fasted": "Low Intensity Cardio Warmup",
  "day 7 fasted cardio workout": "Low Intensity Cardio Warmup",
  "day 10 workout gym fasted": "Low Intensity Cardio Warmup",
  "day 13 fasted cardio walk": "Low Intensity Cardio Warmup",
  "day 17 fasted cardio 35": "Low Intensity Cardio Warmup",
  fastedcardio: "Low Intensity Cardio Warmup",
  "hiit cardio training 30 30": "HIIT Cardio Intervals",
  "hiit cool down 20 20": "HIIT Cardio Intervals",
  "interval hiit cardio": "HIIT Cardio Intervals",
  "scissor kicks 100 interval hiit": "Abdominal Scissor Kicks",
  "jump squats power step ups air squats jumping jacks 12 box jumps":
    "Jump Squats",
  "step ups air squats jumping": "Step Ups",
  "calve raises both legs together": "Calf Raises",
  "seated calve raise machine or": "Seated Calf Raise Machine",
  "seated calf raises": "Seated Calf Raise Machine",
  "standing dumbbell goblet squat": "Goblet Squat",
  "standing dumbbell hack squat": "Hack Squat",
  "dumbell flat bench chest press": "Dumbbell Flat Bench Chest Press",
  "dumbbell should press": "Dumbbell Shoulder Press",
  "seated dumbbell should press": "Seated Dumbbell Shoulder Press",
  "sitting dumbbell shoulder press": "Seated Dumbbell Shoulder Press",
  "hack sumo squat": "Hack Squat",
  "leg press": "Leg Press Machine",
  "leg press machine": "Leg Press Machine",
  "double arm bicep curls both": "Double Arm Bicep Curls",
  "jump squats power": "Jump Squats",
  "dumbbell chest press 40 degree": "Incline Dumbbell Chest Press",
  "dumbbell 40 incline bench chest press": "Incline Dumbbell Chest Press",
  "incline bench chest press medium": "Incline Dumbbell Chest Press",
  "goblet squats with single dumbbell": "Goblet Squat",
  "single dumbbell goblet squats": "Goblet Squat",
  "calf raises both legs together": "Calf Raises",
  "sit ups feet anchored": "Sit Ups",
  "sit ups on the ground with your feet anchored": "Sit Ups",
  "lateral leg raises no resistance": "Lateral Leg Raises",
  "standing lateral leg raises no resistance": "Lateral Leg Raises",
  "abdominal planks": "Plank",
  "abdominal straight leg crunches": "Straight Leg Abdominal Crunches",
  "abdominal bent knee crunches": "Abdominal Bent Knee Crunches",
  "alternating step ups onto 12 step or 1st or 2nd step on stairs": "Step Ups",
  "step ups onto 12 step": "Step Ups",
  "standing alternating step back lunges no weight": "Alternating Step Back Lunges",
  "single leg step back lunges": "Step Back Lunges",
  "barbell hip thrust raise": "Barbell Hip Thrust",
  "bent over dumbbell rear dealt extensions": "Double Arm Rear Delt Extensions",
  "double arm rear dealt extensions": "Double Arm Rear Delt Extensions",
  "shoulder taps push up position": "Shoulder Taps",
  "seated dumbbell double arm bicep curls": "Seated Double Arm Supinated Bicep Curls",
  "standing dumbbell double arm frontal shoulder raises":
    "Double Arm Frontal Shoulder Raises",
  "standing dumbbell double arm lateral shoulder raises":
    "Double Arm Lateral Shoulder Raises",
  "standing cable lat pull over using straight bar":
    "Standing Bands with Handles, Lat Pull Over",
  "1 minute sit up test": "Sit Ups",
  stretch: "Cool Down & Stretch",
  "cool down stretch": "Cool Down & Stretch",
  "laying on mat": "Abdominal Crunches",
  "straight leg crunches": "Straight Leg Abdominal Crunches",
  "romanian dead lift rdl": "Barbell Romanian Deadlift",
  "romanian dead lift rdl 15 15 15": "Barbell Romanian Deadlift",
  "hiit jump squats": "Jump Squats",
  dummybells: "Dumbbell Shoulder Press",
  unknown: "Bench Press",
  "test only do what you": "Push Up Plank Position",
  "this is a strength test only do what you can": "Push Up Plank Position",
};

export function normalizeExerciseKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bcave\b/g, "calf")
    .replace(/\bcalve\b/g, "calf")
    .replace(/\bdealt\b/g, "delt")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleCaseExerciseName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      if (/^\d/.test(word)) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** Pull sets/reps embedded in legacy catalog names into workout prescription fields. */
export function extractPrescriptionFromExerciseName(
  rawName: string,
): ExtractedPrescription {
  const name = rawName.trim();
  const result: ExtractedPrescription = {};

  const commaScheme = name.match(/(\d{1,3}(?:\s*,\s*\d{1,3})+)/);
  if (commaScheme) {
    const nums = commaScheme[1].split(/\s*,\s*/).map((n) => Number(n.trim()));
    if (nums.every((n) => Number.isFinite(n) && n > 0)) {
      result.sets = nums.length;
      result.reps = nums.join(",");
    }
  }

  const hiit = name.match(/(\d+)\s*\/\s*(\d+)/);
  if (hiit) {
    result.reps = `${hiit[1]}s on / ${hiit[2]}s off`;
    result.notes = "HIIT intervals";
  }

  const steps = name.match(/(\d+)\s*steps?\b/i);
  if (steps) {
    result.reps = `${steps[1]} steps`;
  }

  if (!result.reps) {
    const trailing = name.match(/\s(\d{1,3})\s*$/);
    if (trailing && !/\(\d/.test(name)) {
      result.reps = trailing[1];
    }
  }

  if (/each\s+leg/i.test(name)) result.notes = "Each leg";
  if (/each\s+arm/i.test(name)) result.notes = "Each arm";
  if (/cool\s*down/i.test(name)) {
    result.notes = [result.notes, "Cool down"].filter(Boolean).join(" · ");
  }

  return result;
}

export function canonicalExerciseName(rawName: string): string {
  let s = rawName.trim();
  if (!s) return s;

  const explicit = EXPLICIT_CANONICAL[normalizeExerciseKey(s)];
  if (explicit) return explicit;

  s = s.replace(/\bcave\b/gi, "calf");
  s = s.replace(/\bcalve\b/gi, "calf");
  s = s.replace(/\bDumbell\b/gi, "Dumbbell");
  s = s.replace(/\bShould Press\b/gi, "Shoulder Press");
  s = s.replace(/\bExtensios\b/gi, "Extensions");
  s = s.replace(/\bDealt\b/gi, "Delt");

  s = s.replace(/\s*\([^)]*\d[^)]*\)\s*/gi, "");
  s = s.replace(/\s*\(\s*$/, "");
  s = s.replace(/\s*\(\d[^)]*$/i, "");
  s = s.replace(/\s*\([^)]*$/i, "");
  s = s.replace(/\s*\(rdl\)\s*/gi, " ");

  s = s.replace(/\s+\d{1,3}(?:\s*,\s*\d{1,3})+(?:\s+each(?:\s+leg|\s+arm)?)?/gi, "");
  s = s.replace(/\s+\d{1,3}\s*\/\s*\d{1,3}/g, "");
  s = s.replace(/\s+\d+\s*steps?\b/gi, "");
  s = s.replace(/\s+Cool Down\s*$/i, "");
  s = s.replace(/\s+Medium Weight\b/gi, "");
  s = s.replace(/\s+x\s+\d+\s*sets?\s*$/i, "");
  s = s.replace(/\s+\d+\s*sets?\s*(?:each\s+leg)?\s*$/i, "");
  if (!/^\d+\s*(?:minute|min|second|sec|°|degree)/i.test(s)) {
    s = s.replace(/^\d{1,3}\s+(?=[a-z])/i, "");
  }
  s = s.replace(/\s+\d{1,3}\s*$/i, "");

  s = s.replace(/\s*,\s*Laying on.*$/i, "");
  s = s.replace(/\s*,\s*Laying.*$/i, "");
  s = s.replace(/\s+to finish\s*$/i, "");

  s = s.replace(/\s+(?:or|with|from|by|using|hand|knee|onto|each)\s*$/i, "");
  s = s.replace(/\s+$/i, "");
  s = s.replace(/\s+/g, " ").trim();

  const redirected = EXPLICIT_CANONICAL[normalizeExerciseKey(s)];
  if (redirected) return redirected;

  return titleCaseExerciseName(s);
}

export function isJunkExerciseName(rawName: string): boolean {
  const key = normalizeExerciseKey(rawName);
  return (
    /^s1 temp\b/.test(key) ||
    /^qa\b/.test(key) ||
    key === "dummybells" ||
    key === "unknown" ||
    /sexy boob/.test(key) ||
    /slap that ass/.test(key) ||
    /^test only do what you/.test(key) ||
    /^this is a strength test only do what you can/.test(key) ||
    /^1 minute sit up test/.test(key)
  );
}

export function mergePrescriptionNotes(
  existing: string | null | undefined,
  ...parts: Array<string | null | undefined>
): string | null {
  const merged = [existing, ...parts]
    .flatMap((p) => (p ? p.split(" · ") : []))
    .map((p) => p.trim())
    .filter(Boolean);
  const unique = [...new Set(merged)];
  return unique.length > 0 ? unique.join(" · ") : null;
}