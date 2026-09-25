import type { WorkoutSetPhaseInput } from "./workout-prescription";
import { enrichLegacyExerciseRows } from "./workout-prescription-backfill";
import { expandParsedWarmupExercises } from "./warmup-group";

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
  return REP_ONLY.test(cleaned) || /^\d+x\d+$/i.test(cleaned) || /^\d+(?:,\d+)+\s*(each\s+arm)?$/i.test(line);
}

function parseRepLine(line: string): { sets: number; reps: string; notes?: string } {
  const times = line.replace(/\s/g, "").match(/^(\d+)x(\d+)$/i);
  if (times) return { sets: Number(times[1]), reps: times[2] };
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
  const cardioIncline =
    /incline/i.test(line) && /walk|treadmill|bike|jog|cardio|heart/i.test(line);
  const warmupWord =
    /warm|mobility|bands?|bike|treadmill|walk|upper body/i.test(line) || cardioIncline;
  if (!warmupWord) return false;
  // "Shoulder mobility … warm up" is still the warm-up. A bench angle is not.
  if (/warm|mobility/i.test(line)) return true;
  if (/press|extension|squat|curl|row|tricep|chest|bicep|shoulder/i.test(line)) return false;
  return true;
}

/** Light prep listed under an open warm-up, before the first working lift. */
function isWarmupFillerLine(line: string): boolean {
  if (isWarmupLine(line)) return true;
  return (
    /curl|shrug|wall tap|shoulder press|\bband\b/i.test(line) &&
    !/bench|fly|tricep|chest\s+press|incline/i.test(line)
  );
}

function isCooldownLine(line: string) {
  if (/hiit/i.test(line)) return false;
  return /^stretch\s*$/i.test(line) || /^stretch\s+well/i.test(line) || /cool\s*down/i.test(line);
}

function isHiitCooldownLine(line: string) {
  return /hiit/i.test(line) && /cool/i.test(line);
}

function isHiitDetailLine(line: string) {
  if (/^stretch\b/i.test(line) || isExerciseLine(line)) return false;
  return /\d+\s*sec|\bintervals?\b|\d+\s*min/i.test(line);
}

function isTitleLine(line: string, index: number) {
  if (index !== 0) return false;
  if (line.length >= 80 || /\d/.test(line)) return false;
  if (isCooldownLine(line) || isRepLine(line)) return false;
  // Session names such as "Upper Body Workout" or "Chest tricep power".
  // Checked before warm-up so "upper body" in a title is not a warm-up block.
  if (/isolation|core|work|upper|lower|leg|push|pull|full|day|power/i.test(line)) return true;
  if (isWarmupLine(line) || isExerciseLine(line)) return false;
  return true;
}

/** Rest for the working sets ("1 min 30 sec rests"), not a rest-pause cue. */
function isSessionRestLine(line: string): boolean {
  if (/rest\s+pause/i.test(line)) return false;
  return /\brests?\b/i.test(line) && /\d/.test(line);
}

function formatSessionRest(line: string): string {
  const minSec = line.match(/(\d+)\s*min(?:ute)?s?\s*(\d+)\s*sec/i);
  if (minSec) return `${minSec[1]}:${minSec[2].padStart(2, "0")} rests`;
  return line.trim();
}

function isCoachingCue(line: string): boolean {
  if (isExerciseLine(line) || isRepLine(line) || isWarmupLine(line) || isCooldownLine(line)) {
    return false;
  }
  if (isInstructionLine(line) || isSessionRestLine(line)) return true;
  if (
    /hold|burn\s*out|\d+\s*sec|stay\s+flexible|each\s+(leg|arm)|single\s+leg/i.test(line)
  ) {
    return true;
  }
  if (/\d+\s*count\b/i.test(line)) return true;
  if (/squeeze|pinkies|elbow|pulley|degrees?|rest\s+pause|positives?/i.test(line)) return true;
  if (/^bench\s+at\b/i.test(line) || /^hand on\b/i.test(line)) return true;
  return false;
}

/** Equipment or attachment on its own line, continued by the next exercise name. */
function isNameFragment(line: string): boolean {
  if (
    isRepLine(line) ||
    isCoachingCue(line) ||
    isWarmupLine(line) ||
    isCooldownLine(line) ||
    isExerciseLine(line) ||
    isHiitCooldownLine(line)
  ) {
    return false;
  }
  if (line.length > 40 || /\d/.test(line)) return false;
  return /[a-z]/i.test(line);
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
  const setsAndReps = line.match(/^(\d+)\s*sets?\s+(?:of\s+)?(\d+)\s*reps?\.?$/i);
  if (setsAndReps) {
    current.sets = Number(setsAndReps[1]);
    current.reps = setsAndReps[2];
    return true;
  }
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
  let pendingHeader: string | null = null;
  let pendingNamePrefix: string | null = null;
  let warmupOpen = false;
  let prescriptionClosed = false;
  let sessionRestNote: string | null = null;

  const flushWarmup = () => {
    if (warmupLines.length === 0) return;
    const expanded = expandParsedWarmupExercises([
      {
        name: "Warm-up",
        sets: 1,
        reps: "—",
        notes: warmupLines.join("\n"),
        section: "warmup" as const,
      },
    ]);
    exercises.push(...expanded);
    warmupLines.length = 0;
  };

  const pushCurrent = () => {
    if (!current) return;
    if (
      current.section === "main" &&
      sessionRestNote &&
      !(current.notes || "").includes(sessionRestNote)
    ) {
      current.notes = [current.notes, sessionRestNote].filter(Boolean).join(" · ");
    }
    exercises.push(current);
    current = null;
    prescriptionClosed = false;
  };

  const startExercise = (line: string): ParsedSmsExercise => {
    flushWarmup();
    pushCurrent();
    warmupOpen = false;
    const prefix = pendingNamePrefix;
    pendingNamePrefix = null;
    const combined = `${prefix ? `${prefix} ` : ""}${line}`.replace(/\.\s*$/, "");
    const { name, reps } = parseExerciseNameAndReps(combined);
    const header = pendingHeader;
    pendingHeader = null;
    prescriptionClosed = Boolean(reps);
    return {
      name: titleCaseName(name),
      sets: 1,
      reps: reps || "—",
      section: "main",
      notes: header || undefined,
    };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isTitleLine(line, i)) {
      title = line.replace(/^so\s+/i, "").trim();
      title = title.charAt(0).toUpperCase() + title.slice(1);
      continue;
    }

    if (isHiitCooldownLine(line)) {
      flushWarmup();
      pushCurrent();
      warmupOpen = false;
      pendingNamePrefix = null;
      const details: string[] = [];
      while (i + 1 < lines.length && isHiitDetailLine(lines[i + 1])) {
        i += 1;
        details.push(lines[i]);
      }
      const chunk = [line, ...details].join(" ");
      const duration = chunk.match(/(\d+)\s*min/i)?.[1] || "5";
      const seconds = details.join(" ").match(/(\d+)\s*sec/i);
      const onOff = chunk.match(/(\d+)\s*sec\s+on\s+(\d+)\s*sec\s+off/i);
      exercises.push({
        name: "HIIT Cooldown",
        sets: 1,
        reps: `${duration} min`,
        notes: onOff
          ? `${onOff[1]}s on / ${onOff[2]}s off`
          : seconds
            ? `${seconds[1]} sec intervals`
            : details.join(" · ") || undefined,
        section: "cooldown",
        setScheme: "timed",
      });
      continue;
    }

    if (isCooldownLine(line)) {
      flushWarmup();
      pushCurrent();
      warmupOpen = false;
      pendingNamePrefix = null;
      const bareStretch = /^stretch\s*$/i.test(line);
      exercises.push({
        name: bareStretch ? "Stretch" : "Cool Down & Stretch",
        sets: 1,
        reps: "—",
        notes: bareStretch ? undefined : line,
        section: "cooldown",
      });
      continue;
    }

    if (isSessionRestLine(line) && !current) {
      sessionRestNote = formatSessionRest(line);
      continue;
    }

    if (!current && (isWarmupLine(line) || (warmupOpen && isWarmupFillerLine(line)))) {
      warmupOpen = true;
      if (!/^same as usual\.?$/i.test(line)) warmupLines.push(line);
      continue;
    }

    if (
      warmupOpen &&
      !current &&
      !isExerciseLine(line) &&
      !isRepLine(line) &&
      !isCooldownLine(line)
    ) {
      if (!/^same as usual\.?$/i.test(line)) warmupLines.push(line);
      continue;
    }

    if (isRepLine(line) && (current || pendingNamePrefix)) {
      if (!current && pendingNamePrefix) {
        const name = pendingNamePrefix;
        pendingNamePrefix = null;
        current = startExercise(name);
      }
      if (current) {
        const parsed = parseRepLine(line);
        current.sets = parsed.sets;
        current.reps = parsed.reps;
        if (parsed.notes) {
          current.notes = [current.notes, parsed.notes].filter(Boolean).join(" · ");
        }
        prescriptionClosed = true;
        continue;
      }
    }

    if (current && applySetsFromLine(current, line)) {
      prescriptionClosed = true;
      continue;
    }

    if (current && applyHiitTiming(current, line)) {
      prescriptionClosed = true;
      continue;
    }

    if (current && (isCoachingCue(line) || /^each\s+arm/i.test(line))) {
      current.notes = [current.notes, line].filter(Boolean).join(" · ");
      continue;
    }

    if (isExerciseLine(line) || /^jump\s+squats?\s+\d+/i.test(line)) {
      const jump = line.match(/^jump\s+squats?\s+(\d+)/i);
      current = startExercise(line);
      if (jump) current.reps = jump[1];
      continue;
    }

    if (prescriptionClosed && isNameFragment(line)) {
      pendingNamePrefix = line.replace(/\.\s*$/, "");
      pushCurrent();
      continue;
    }

    if (current) {
      current.notes = [current.notes, line].filter(Boolean).join(" · ");
      continue;
    }

    if (pendingNamePrefix) {
      pendingNamePrefix = `${pendingNamePrefix} ${line}`.replace(/\.\s*$/, "");
      continue;
    }

    // Unknown lines after a warm-up header stay in the warm-up blob.
    // Bare section titles ("Better for back") are notes on the next lift.
    if (warmupLines.length > 0 || warmupOpen) {
      if (!/^same as usual\.?$/i.test(line)) warmupLines.push(line);
    } else {
      pendingHeader = line;
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