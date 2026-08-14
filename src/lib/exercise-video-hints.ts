/**
 * Fallback YouTube demos when the library exercise has no videoUrl.
 * Prefer YouTube Shorts / under ~1 min form demos where possible.
 * Coach can still override by setting Exercise.videoUrl in the library.
 *
 * Curated Jul 2026 for Maintain sessions + common gym patterns.
 */

/** Exact / near-exact exercise names used in Maintain (and catalog). */
const EXACT_NAME_VIDEOS: Record<string, string> = {
  // Upper push
  "Incline Dumbbell Chest Press":
    "https://www.youtube.com/shorts/8fXfwG4ftaQ",
  "Dumbbell Flat Bench Chest Press":
    "https://www.youtube.com/shorts/1V3vpcaxRYQ",
  "Double Arm Lateral Shoulder Raises":
    "https://www.youtube.com/shorts/Myim1WH6Qec",
  "Standing Lateral and Frontal Shoulder Raises Superset":
    "https://www.youtube.com/shorts/Kl3LEzQ5Zqs",
  "Standing Straight Bar Cable Tricep Extensions":
    "https://www.youtube.com/shorts/1FjkhpZsaxc",
  "Incline Bench, Dumbbell Chest Fly":
    "https://www.youtube.com/shorts/ozAhti8BK6s",

  // Upper pull
  "Cable Lat Pull Downs": "https://www.youtube.com/shorts/z-lxcsIN4T4",
  "Dumbbell Bent Over Row": "https://www.youtube.com/shorts/IOOLhrkN_NI",
  "Seated Cable Back Row-Close Grip Row Bar, Double arm":
    "https://www.youtube.com/shorts/8QuMq1GMMng",
  "Standing Dumbbell Supinated Bicep Curls":
    "https://www.youtube.com/shorts/YgHnvJQkfhc",
  "Dumbbell Hammer Curls": "https://www.youtube.com/shorts/NyW2fT2gQhM",

  // Lower
  "Barbell Back Squat": "https://www.youtube.com/shorts/7eWS45uEx7Q",
  "Barbell Romanian Deadlift": "https://www.youtube.com/shorts/5rIqP63yWFg",
  "Leg Press Machine": "https://www.youtube.com/shorts/nDh_BlnLCGc",
  "Step Back Lunges-Alternating":
    "https://www.youtube.com/shorts/ljZA17b52FE",
  "Barbell Hip Thrust": "https://www.youtube.com/shorts/W86oVlnLqY4",
  "Calf Raises": "https://www.youtube.com/shorts/rsOLKY02m70",
  "Air Squats": "https://www.youtube.com/shorts/dVjfUlXK93k",

  // Core + engine / shared
  Plank: "https://www.youtube.com/shorts/j6WVxGJZv5Y",
  "Abdominal Scissor Kicks": "https://www.youtube.com/watch?v=0vDI5aU402c",
  "Band Lateral Shoulder Raises":
    "https://www.youtube.com/shorts/Myim1WH6Qec",
  "Hip Abduction Machine": "https://www.youtube.com/shorts/Z6Aq5upUp4A",
};

/** Pattern fallbacks when name is not in EXACT_NAME_VIDEOS. More specific first. */
const VIDEO_HINTS: Array<{ pattern: RegExp; videoUrl: string }> = [
  // Shoulders
  {
    pattern: /shoulder press|overhead press/i,
    videoUrl: "https://www.youtube.com/shorts/OLePvpxQEGk",
  },
  {
    pattern: /lateral shoulder|lateral raise|double arm lateral/i,
    videoUrl: "https://www.youtube.com/shorts/Myim1WH6Qec",
  },
  {
    pattern: /frontal shoulder|front raise/i,
    videoUrl: "https://www.youtube.com/shorts/h9xfpTrAvkE",
  },
  {
    pattern: /lateral and frontal|shoulder raises superset/i,
    videoUrl: "https://www.youtube.com/shorts/Kl3LEzQ5Zqs",
  },
  // Chest
  {
    pattern: /incline.*fly|fly.*incline/i,
    videoUrl: "https://www.youtube.com/shorts/ozAhti8BK6s",
  },
  {
    pattern: /incline.*press|incline dumbbell chest/i,
    videoUrl: "https://www.youtube.com/shorts/8fXfwG4ftaQ",
  },
  {
    pattern: /flat bench|chest press|dumbbell.*bench press|bench press/i,
    videoUrl: "https://www.youtube.com/shorts/1V3vpcaxRYQ",
  },
  {
    pattern: /chest fly|pec fly/i,
    videoUrl: "https://www.youtube.com/shorts/ozAhti8BK6s",
  },
  // Legs
  {
    pattern: /hip thrust/i,
    videoUrl: "https://www.youtube.com/shorts/W86oVlnLqY4",
  },
  {
    pattern: /leg press/i,
    videoUrl: "https://www.youtube.com/shorts/nDh_BlnLCGc",
  },
  {
    pattern: /step back lunge|reverse lunge|lunge/i,
    videoUrl: "https://www.youtube.com/shorts/ljZA17b52FE",
  },
  {
    pattern: /air squat|bodyweight squat/i,
    videoUrl: "https://www.youtube.com/shorts/dVjfUlXK93k",
  },
  {
    pattern: /back squat|barbell.*squat|squat|goblet|bulgarian|hack/i,
    videoUrl: "https://www.youtube.com/shorts/7eWS45uEx7Q",
  },
  {
    pattern: /romanian|rdl/i,
    videoUrl: "https://www.youtube.com/shorts/5rIqP63yWFg",
  },
  {
    pattern: /deadlift|hinge/i,
    videoUrl: "https://www.youtube.com/shorts/5rIqP63yWFg",
  },
  {
    pattern: /calf/i,
    videoUrl: "https://www.youtube.com/shorts/rsOLKY02m70",
  },
  {
    pattern: /abduction|adduction/i,
    videoUrl: "https://www.youtube.com/shorts/Z6Aq5upUp4A",
  },
  // Back
  {
    pattern: /lat pull|pulldown|pull.?down/i,
    videoUrl: "https://www.youtube.com/shorts/z-lxcsIN4T4",
  },
  {
    pattern: /bent over row|dumbbell.*row/i,
    videoUrl: "https://www.youtube.com/shorts/IOOLhrkN_NI",
  },
  {
    pattern: /seated.*row|cable.*row|low.?row/i,
    videoUrl: "https://www.youtube.com/shorts/8QuMq1GMMng",
  },
  {
    pattern: /\brow\b|pull|chin|lat\b/i,
    videoUrl: "https://www.youtube.com/shorts/IOOLhrkN_NI",
  },
  // Arms
  {
    pattern: /hammer curl/i,
    videoUrl: "https://www.youtube.com/shorts/NyW2fT2gQhM",
  },
  {
    pattern: /curl|bicep/i,
    videoUrl: "https://www.youtube.com/shorts/YgHnvJQkfhc",
  },
  {
    pattern: /tricep|extension|pushdown|push.?down/i,
    videoUrl: "https://www.youtube.com/shorts/1FjkhpZsaxc",
  },
  // Core
  {
    pattern: /scissor|flutter/i,
    videoUrl: "https://www.youtube.com/watch?v=0vDI5aU402c",
  },
  {
    pattern: /plank/i,
    videoUrl: "https://www.youtube.com/shorts/j6WVxGJZv5Y",
  },
  {
    pattern: /core|ab\b|crunch/i,
    videoUrl: "https://www.youtube.com/shorts/j6WVxGJZv5Y",
  },
  // Conditioning / misc — CrossFit air squat demo (~42s) as generic move
  {
    pattern: /hiit|jump|interval|cardio/i,
    videoUrl: "https://www.youtube.com/watch?v=C_VtOYc6j5c",
  },
  {
    pattern: /shoulder mobility|mobility|resistance band|band pull/i,
    videoUrl: "https://www.youtube.com/watch?v=2-LAMcpzODU",
  },
  {
    pattern: /stretch|cool\s*down|warm\s*up|warm up well|bike|row/i,
    videoUrl: "https://www.youtube.com/watch?v=ultWZbUMr08",
  },
];

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function hintVideoUrlForExerciseName(name: string): string | null {
  const key = normalizeName(name);
  if (EXACT_NAME_VIDEOS[key]) return EXACT_NAME_VIDEOS[key];

  // Case-insensitive exact match on map keys
  const lower = key.toLowerCase();
  for (const [k, url] of Object.entries(EXACT_NAME_VIDEOS)) {
    if (k.toLowerCase() === lower) return url;
  }

  for (const { pattern, videoUrl } of VIDEO_HINTS) {
    if (pattern.test(key)) return videoUrl;
  }
  return null;
}

export function resolveExerciseVideoUrl(
  exercise: { name: string; videoUrl?: string | null },
): string | null {
  if (exercise.videoUrl?.trim()) return exercise.videoUrl.trim();
  return hintVideoUrlForExerciseName(exercise.name);
}
