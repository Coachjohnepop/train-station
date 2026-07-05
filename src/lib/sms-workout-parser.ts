import type { WorkoutSetPhaseInput } from "./workout-prescription";
import { enrichLegacyExerciseRows } from "./workout-prescription-backfill";

export type ParsedSmsExercise = {
  name: string;
  sets: number;
  reps: string;
  notes?: string;
  setScheme?: "standard" | "timed";
  section?: "warmup" | "main" | "cooldown" | "notes";
  /** Structured prescription (set after parse). */
  setCount?: number;
  restBetweenSetsSec?: number | null;
  phases?: WorkoutSetPhaseInput[];
  pattern?: string;
};

export type ParsedSmsWorkout = {
  title: string;
  exercises: ParsedSmsExercise[];
  rawText: string;
};

const REP_ONLY = /^(\d+(?:\s*,\s*\d+)+|\d+)$/;

const INSTRUCTION_LINE =
  /^(then|stay|hold\b|rest\s+periods?|immediately|burnout|stay\s+flexible|on\s+\d|flexible)$/i;
const DURATION_OR_SETS_LINE =
  /^(\d+\s*(?:sec|min|mins|rounds?)\b|x\s*\d+\s*sets?|\d+\s*sets?\s*(?:each\s+leg)?$)/i;

const EXERCISE_KEYWORDS =
  /squat|press|extension|curl|row|pull|push|lunge|deadlift|raise|fly|crunch|plank|thrust|hip|calve|calf|bulgarian|bicep|hiit|jump|leg\s+press|barbell|dumbbell|machine|lift|intestine|hardening|boob/i;

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

function parseExerciseNameAndReps(line: string): { name: string; reps?: string } {
  const leadingCount = line.match(/^(\d+)\s+(.+)$/i);
  if (leadingCount) {
    return { name: leadingCount[2].trim(), reps: leadingCount[1] };
  }
  const trailingCount = line.match(/^(.+?)\s+(\d+)\s*$/);
  if (trailingCount && EXERCISE_KEYWORDS.test(trailingCount[1])) {
    return { name: trailingCount[1].trim(), reps: trailingCount[2] };
  }
  return { name: line.trim() };
}

function titleCaseName(name: string): string {
  const s = name.trim();
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isInstructionLine(line: string): boolean {
  if (INSTRUCTION_LINE.test(line)) return true;
  if (DURATION_OR_SETS_LINE.test(line)) return true;
  if (/^\d+\s*sec\b/i.test(line)) return true;
  if (/burnout\s+reps/i.test(line) && !EXERCISE_KEYWORDS.test(line)) return true;
  if (/hold at/i.test(line) && !/thrust|squat|press|raise/i.test(line)) return true;
  return false;
}

function isWarmupLine(line: string) {
  return (
    /warm|mobility|bands?|bike|treadmill|walk|upper body|incline/i.test(line) &&
    !/press|extension|squat|curl|row|tricep|chest|bicep|shoulder/i.test(line)
  );
}

function isCooldownLine(line: string) {
  return /^stretch\s*$/i.test(line) || /^stretch\s+well/i.test(line) || /cool\s*down/i.test(line);
}

function isTitleLine(line: string, index: number) {
  if (index !== 0) return false;
  return /isolation|core|work|upper|lower|leg|push|pull|full/i.test(line) && line.length < 80;
}

function isExerciseLine(line: string) {
  if (isRepLine(line)) return false;
  if (isInstructionLine(line)) return false;
  if (isWarmupLine(line)) return false;
  if (isCooldownLine(line)) return false;
  if (/^leg\s+press$/i.test(line)) return true;
  if (/^hiit\s+/i.test(line)) return true;
  return EXERCISE_KEYWORDS.test(line);
}

function applySetsFromLine(current: ParsedSmsExercise, line: string): boolean {
  const setsOnly = line.match(/^(\d+)\s*sets?\s*(each\s+leg)?$/i);
  if (setsOnly) {
    current.sets = Number(setsOnly[1]);
    if (setsOnly[2]) current.notes = [current.notes, "Each leg"].filter(Boolean).join(" · ");
    return true;
  }
  const xSets = line.match(/x\s*(\d+)\s*sets?/i);
  if (xSets) {
    current.sets = Number(xSets[1]);
    return true;
  }
  const eachLeg = line.match(/^(\d+)\s*sets?\s*each\s+leg$/i);
  if (eachLeg) {
    current.sets = Number(eachLeg[1]);
    current.notes = [current.notes, "Each leg"].filter(Boolean).join(" · ");
    return true;
  }
  return false;
}

function appendCoachingCue(current: ParsedSmsExercise, line: string) {
  if (
    /hold|burnout|burn\s*out|\d+\s*sec|reps?\s+immediately|stay\s+flexible|each\s+leg|single\s+leg/i.test(
      line,
    )
  ) {
    current.notes = [current.notes, line].filter(Boolean).join(" · ");
  }
}

function applyHiitTiming(current: ParsedSmsExercise, line: string) {
  const rounds = line.match(/(\d+)\s*rounds?\s*(?:on\s*)?(\d+)\s*sec/i);
  if (rounds) {
    current.sets = Number(rounds[1]);
    current.reps = `${rounds[2]}s on`;
    current.setScheme = "timed";
    return true;
  }
  const timed = line.match(/(\d+)\s*sec\s+on\s+(\d+)\s*sec\s+off/i);
  if (timed) {
    current.reps = `${timed[1]}s on / ${timed[2]}s off`;
    current.setScheme = "timed";
    return true;
  }
  return false;
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

  const startExercise = (line: string): ParsedSmsExercise => {
    flushWarmup();
    pushCurrent();
    const { name, reps } = parseExerciseNameAndReps(line);
    return {
      name: titleCaseName(name),
      sets: 1,
      reps: reps || "—",
      section: "main",
    };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isTitleLine(line, i)) {
      title = line.replace(/^so\s+/i, "").trim();
      title = title.charAt(0).toUpperCase() + title.slice(1);
      continue;
    }

    if (isCooldownLine(line)) {
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

    if (current && applySetsFromLine(current, line)) {
      appendCoachingCue(current, line);
      continue;
    }

    if (current && applyHiitTiming(current, line)) {
      appendCoachingCue(current, line);
      continue;
    }

    if (/^each\s+arm/i.test(line) && current) {
      current.notes = [current.notes, line].filter(Boolean).join(" · ");
      continue;
    }

    if (/^jump\s+squats?\s+(\d+)/i.test(line)) {
      const m = line.match(/^jump\s+squats?\s+(\d+)/i);
      current = startExercise(line);
      if (m) current.reps = m[1];
      continue;
    }

    if (isExerciseLine(line)) {
      current = startExercise(line);
      continue;
    }

    if (current) {
      if (applySetsFromLine(current, line)) {
        appendCoachingCue(current, line);
        continue;
      }
      if (applyHiitTiming(current, line)) {
        appendCoachingCue(current, line);
        continue;
      }
      if (isInstructionLine(line) || /hold|burnout|burn\s*out|\d+\s*sec/i.test(line)) {
        appendCoachingCue(current, line);
        continue;
      }
      current.notes = [current.notes, line].filter(Boolean).join(" · ");
    } else if (!isCooldownLine(line)) {
      warmupLines.push(line);
    }
  }

  flushWarmup();
  pushCurrent();

  const enriched = enrichLegacyExerciseRows(
    exercises.map((ex) => ({
      ...ex,
      sets: ex.sets,
      reps: ex.reps,
      restSec: null,
      notes: ex.notes ?? null,
      setScheme: ex.setScheme ?? null,
      exerciseName: ex.name,
    })),
  );

  for (let i = 0; i < exercises.length; i++) {
    const e = enriched[i];
    if (!("prescription" in e)) continue;
    exercises[i] = {
      ...exercises[i],
      setCount: e.prescription.setCount,
      restBetweenSetsSec: e.prescription.restBetweenSetsSec,
      phases: e.prescription.phases,
      pattern: e.pattern,
      notes: e.cleanedNotes ?? exercises[i].notes,
      sets: e.prescription.setCount,
    };
  }

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