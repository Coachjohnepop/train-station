export type ParsedSmsExercise = {
  name: string;
  sets: number;
  reps: string;
  notes?: string;
  setScheme?: "standard" | "timed";
  section?: "warmup" | "main" | "cooldown" | "notes";
};

export type ParsedSmsWorkout = {
  title: string;
  exercises: ParsedSmsExercise[];
  rawText: string;
};

const REP_ONLY = /^(\d+(?:\s*,\s*\d+)+|\d+)$/;
const REP_WITH_NOTE = /^(\d+(?:\s*,\s*\d+)+|\d+)\s*(.+)$/i;

function isRepLine(line: string) {
  const cleaned = line.replace(/\s/g, "");
  return REP_ONLY.test(cleaned) || /^\d+(?:,\d+)+\s*(each\s+arm)?$/i.test(line);
}

function parseRepLine(line: string): { sets: number; reps: string; notes?: string } {
  const eachArm = /each\s+arm/i.test(line);
  const nums = line.match(/\d+/g)?.map(Number) || [];
  const notes = eachArm ? "Each arm" : undefined;

  if (nums.length === 0) return { sets: 1, reps: line, notes };

  if (nums.length === 1 && nums[0] > 15 && !line.includes(",")) {
    return { sets: 1, reps: String(nums[0]), notes };
  }

  return { sets: nums.length, reps: nums.join(","), notes };
}

function isWarmupLine(line: string) {
  return /warm|mobility|bands?|bike|upper body/i.test(line) && !/press|extension|squat|curl|row|tricep|chest/i.test(line);
}

function isCooldownLine(line: string) {
  return /stretch|hiit|cool\s*down/i.test(line);
}

function isTitleLine(line: string, index: number) {
  if (index !== 0) return false;
  return /isolation|core|work|upper|lower|leg|push|pull|full/i.test(line) && line.length < 80;
}

function isExerciseLine(line: string) {
  if (isRepLine(line)) return false;
  if (isWarmupLine(line)) return false;
  if (/^stretch\s+well/i.test(line)) return false;
  return /squat|press|extension|curl|row|pull|push|lunge|deadlift|raise|fly|crunch|plank/i.test(line);
}

export function parseSmsWorkout(rawText: string): ParsedSmsWorkout {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let title = "Coach SMS Workout";
  const exercises: ParsedSmsExercise[] = [];
  let current: ParsedSmsExercise | null = null;
  const warmupLines: string[] = [];

  const flushWarmup = () => {
    if (warmupLines.length === 0) return;
    exercises.push({
      name: "Warm-up",
      sets: 1,
      reps: "—",
      notes: warmupLines.join("\n"),
      section: "warmup",
    });
    warmupLines.length = 0;
  };

  const pushCurrent = () => {
    if (!current) return;
    exercises.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isTitleLine(line, i)) {
      title = line.replace(/^so\s+/i, "").trim();
      title = title.charAt(0).toUpperCase() + title.slice(1);
      continue;
    }

    if (/^stretch\s+well/i.test(line)) {
      flushWarmup();
      pushCurrent();
      exercises.push({
        name: "Stretch / Cool-down",
        sets: 1,
        reps: "—",
        notes: line,
        section: "cooldown",
      });
      continue;
    }

    if (/hiit\s+cool/i.test(line)) {
      flushWarmup();
      pushCurrent();
      const chunk = lines.slice(i, Math.min(i + 4, lines.length)).join(" ");
      const duration = chunk.match(/(\d+)\s*min/i)?.[1] || "5";
      const timed = chunk.match(/(\d+)\s*sec\s+on\s+(\d+)\s*sec\s+off/i);
      exercises.push({
        name: "HIIT Cool-down",
        sets: 1,
        reps: `${duration} min`,
        notes: timed ? `${timed[1]}s on / ${timed[2]}s off` : chunk,
        section: "cooldown",
        setScheme: "timed",
      });
      i += 2;
      continue;
    }

    if (isWarmupLine(line)) {
      pushCurrent();
      warmupLines.push(line);
      continue;
    }

    if (isRepLine(line) && current) {
      const parsed = parseRepLine(line);
      current.sets = parsed.sets;
      current.reps = parsed.reps;
      if (parsed.notes) current.notes = [current.notes, parsed.notes].filter(Boolean).join(" · ");
      continue;
    }

    if (/^each\s+arm/i.test(line) && current) {
      current.notes = [current.notes, line].filter(Boolean).join(" · ");
      continue;
    }

    if (/^jump\s+squats?\s+(\d+)/i.test(line)) {
      flushWarmup();
      pushCurrent();
      const m = line.match(/^jump\s+squats?\s+(\d+)/i);
      exercises.push({
        name: "Jump Squats",
        sets: 1,
        reps: m?.[1] || "20",
        section: "main",
      });
      continue;
    }

    if (isExerciseLine(line)) {
      flushWarmup();
      pushCurrent();
      current = {
        name: line.charAt(0).toUpperCase() + line.slice(1),
        sets: 1,
        reps: "—",
        section: "main",
      };
      continue;
    }

    if (current) {
      current.notes = [current.notes, line].filter(Boolean).join(" · ");
    } else if (!isCooldownLine(line)) {
      warmupLines.push(line);
    }
  }

  flushWarmup();
  pushCurrent();

  if (exercises.length === 0) {
    exercises.push({
      name: "Coach-prescribed session",
      sets: 1,
      reps: "—",
      notes: rawText,
      section: "notes",
    });
  }

  return { title, exercises, rawText };
}