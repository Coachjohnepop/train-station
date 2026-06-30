/** Fallback YouTube demos when the matched library exercise has no videoUrl. */
const VIDEO_HINTS: Array<{ pattern: RegExp; videoUrl: string }> = [
  {
    pattern: /shoulder|military press/i,
    videoUrl: "https://www.youtube.com/watch?v=ZaDlbm8E8Tg",
  },
  {
    pattern: /bench|chest press|flat bench/i,
    videoUrl: "https://www.youtube.com/watch?v=8iPEnn-ltC8",
  },
  {
    pattern: /squat|leg press|goblet|bulgarian|lunge|hack/i,
    videoUrl: "https://www.youtube.com/watch?v=ultWZbUMr08",
  },
  {
    pattern: /deadlift|hinge|thrust|romanian/i,
    videoUrl: "https://www.youtube.com/watch?v=1f8yoFFdkcY",
  },
  {
    pattern: /pull|row|lat|chin/i,
    videoUrl: "https://www.youtube.com/watch?v=eGo4IYlbE5g",
  },
  {
    pattern: /curl|bicep/i,
    videoUrl: "https://www.youtube.com/watch?v=jMQA3XtJSgo",
  },
  {
    pattern: /calf|calve|raise/i,
    videoUrl: "https://www.youtube.com/watch?v=ultWZbUMr08",
  },
  {
    pattern: /hiit|jump|interval|cardio/i,
    videoUrl: "https://www.youtube.com/watch?v=ultWZbUMr08",
  },
  {
    pattern: /stretch|cool\s*down|warm\s*up/i,
    videoUrl: "https://www.youtube.com/watch?v=ultWZbUMr08",
  },
];

export function hintVideoUrlForExerciseName(name: string): string | null {
  for (const { pattern, videoUrl } of VIDEO_HINTS) {
    if (pattern.test(name)) return videoUrl;
  }
  return null;
}

export function resolveExerciseVideoUrl(
  exercise: { name: string; videoUrl?: string | null },
): string | null {
  if (exercise.videoUrl) return exercise.videoUrl;
  return hintVideoUrlForExerciseName(exercise.name);
}