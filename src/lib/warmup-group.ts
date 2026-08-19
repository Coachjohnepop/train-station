import { resolveExerciseVideoUrl } from "@/lib/exercise-video-hints";
import { resolveExerciseHoldSeconds } from "@/lib/rest-timer";
import { isStandardWarmupLineName } from "@/lib/warmup-template";
import { isTimedApproach } from "@/lib/workout-schemes";

const WARMUP_BLOCK_NOTE_RE = /warm[- ]?up\s+block/i;
const WARMUP_NOTE_TAG_RE = /^warm[- ]?up$/i;
const WARMUP_HEADER_RE =
  /^warm[- ]?up\b/i;
const BONUS_POINTS_RE = /bonus points|before coach arrives/i;

export const DEFAULT_WARMUP_REST_SECONDS = 15;

/**
 * Each warm-up movement is a real WorkoutExercise (catalog + video + admin
 * edit). The member floor collapses the leading tagged run into one card.
 * A leftover SMS "Warm-up" notes blob is expanded into rows on parse/save;
 * the UI still understands old blobs so in-progress sessions keep working.
 */
export function normalizeWarmupRestSeconds(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_WARMUP_REST_SECONDS;
  return Math.max(5, Math.min(120, Math.round(n)));
}

export function notesMarkWarmup(notes: string): boolean {
  if (WARMUP_BLOCK_NOTE_RE.test(notes)) return true;
  return notes
    .split(/[·\n;]/)
    .map((part) => part.trim())
    .some((part) => WARMUP_NOTE_TAG_RE.test(part));
}

/** Add or strip the durable "Warm-up block" tag without wiping other coach notes. */
export function withWarmupBlockNote(
  notes: string | null | undefined,
  on: boolean,
): string | null {
  const parts = String(notes || "")
    .split(/[·\n;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !WARMUP_NOTE_TAG_RE.test(part) && !WARMUP_BLOCK_NOTE_RE.test(part));
  if (on) parts.push("Warm-up block");
  return parts.length ? parts.join(" · ") : null;
}

/** A line is warm-up if Jeremy tagged it, or it is a standard template name. */
export function isWarmupWorkoutLine(ex: {
  name: string;
  notes?: string | null;
  coachNotes?: string | null;
  description?: string | null;
}): boolean {
  const notes = `${ex.notes || ""} ${ex.coachNotes || ""} ${ex.description || ""}`;
  if (notesMarkWarmup(notes)) return true;
  return isStandardWarmupLineName(ex.name);
}

/**
 * Leading run of warm-up lines at the top of the workout.
 * Stops at the first main lift so "Band Lat Pulldown" later is not eaten.
 */
export function leadingWarmupCount(
  exercises: Array<{
    name: string;
    notes?: string | null;
    coachNotes?: string | null;
    description?: string | null;
  }>,
): number {
  let n = 0;
  for (const ex of exercises) {
    if (!isWarmupWorkoutLine(ex)) break;
    n += 1;
  }
  return n;
}

export function shortWarmupLabel(name: string): string {
  let trimmed = name.replace(/^warm[- ]?up\s*(well\s*)?/i, "").trim();
  trimmed = trimmed.replace(/^\d+\s*(min|mins|minutes|sec|s)\s+/i, "").trim();
  trimmed = trimmed.replace(/,\s*or\s+/i, ", ").trim();
  if (!trimmed) return "Warm-up";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export type ParsedWarmupNoteLine = {
  name: string;
  reps: string | null;
  timed: boolean;
  holdSeconds: number | null;
};

/** Turn a stored "Warm-up" notes blob into named movements (SMS / lesson-plan shape). */
export function parseWarmupNoteMovements(
  raw: string | null | undefined,
): ParsedWarmupNoteLine[] {
  const text = String(raw || "").trim();
  if (!text) return [];
  const chunks = text
    .split(/\r?\n+|·|;|\u2022/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: ParsedWarmupNoteLine[] = [];
  for (const chunk of chunks) {
    if (WARMUP_NOTE_TAG_RE.test(chunk) || WARMUP_BLOCK_NOTE_RE.test(chunk)) continue;
    if (WARMUP_HEADER_RE.test(chunk) && BONUS_POINTS_RE.test(chunk)) continue;
    if (WARMUP_HEADER_RE.test(chunk) && chunk.length < 16) continue;
    if (/^rest\s+periods?/i.test(chunk)) continue;
    if (/^stay\s+flexible$/i.test(chunk)) continue;
    if (/^\d+\s*(min|mins|minutes|sec|secs|s)$/i.test(chunk)) continue;

    const duration = chunk.match(/(\d+(?:\.\d+)?)\s*(min|mins|minutes|sec|secs|s)\b/i);
    const cardio = /bike|row|walk|cardio|treadmill/i.test(chunk);
    const trailingReps = chunk.match(/^(.*?)[\s,]+(\d+)\s*(reps?)?$/i);

    if (duration && cardio) {
      const n = Number(duration[1]);
      const isMin = /^min/i.test(duration[2]);
      const holdSeconds =
        Number.isFinite(n) && n > 0
          ? Math.round(isMin ? n * 60 : n)
          : null;
      const name = chunk
        .replace(/^\d+(?:\.\d+)?\s*(min|mins|minutes|sec|secs|s)\s+/i, "")
        .trim();
      out.push({
        name: shortWarmupLabel(name || "Bike"),
        reps: `${duration[1]} ${isMin ? "min" : "sec"}`,
        timed: true,
        holdSeconds: holdSeconds && holdSeconds >= 5 ? holdSeconds : null,
      });
      continue;
    }

    if (trailingReps && trailingReps[1].trim().length > 2) {
      out.push({
        name: shortWarmupLabel(trailingReps[1]),
        reps: trailingReps[2],
        timed: false,
        holdSeconds: null,
      });
      continue;
    }

    out.push({
      name: shortWarmupLabel(chunk),
      reps: null,
      timed: false,
      holdSeconds: null,
    });
  }
  return out;
}

export type ExpandableWarmupExercise = {
  name: string;
  sets: number;
  reps: string;
  notes?: string;
  setScheme?: "standard" | "timed";
  section?: "warmup" | "main" | "cooldown" | "notes";
};

/**
 * Turn a generic "Warm-up" blob into one persistable exercise per movement
 * so admin / WorkoutExercise rows stay first-class.
 */
export function expandParsedWarmupExercises<T extends ExpandableWarmupExercise>(
  exercises: T[],
): T[] {
  const out: T[] = [];
  for (const ex of exercises) {
    const genericName = /^warm[- ]?up(\s*\(.*\))?$/i.test(ex.name.trim());
    const tagged = ex.section === "warmup" || genericName;
    if (!tagged) {
      out.push(ex);
      continue;
    }
    const moves = parseWarmupNoteMovements(
      [genericName ? null : ex.name, ex.notes].filter(Boolean).join("\n"),
    );
    if (moves.length <= 1) {
      const move = moves[0];
      out.push({
        ...ex,
        name: move?.name || ex.name,
        reps: move?.reps || ex.reps,
        setScheme: move?.timed ? "timed" : ex.setScheme,
        section: "warmup",
        notes: genericName ? undefined : ex.notes,
      });
      continue;
    }
    for (const move of moves) {
      out.push({
        ...ex,
        name: move.name,
        sets: 1,
        reps: move.reps || (move.timed ? "5 min" : "—"),
        notes: undefined,
        setScheme: move.timed ? "timed" : "standard",
        section: "warmup",
      });
    }
  }
  return out;
}

export type WarmupMovement = {
  key: string;
  blockId: string;
  setNum: number;
  name: string;
  label: string;
  videoUrl: string | null;
  description: string | null;
  setScheme: string;
  reps: string | null;
  setCount: number;
  holdSeconds: number | null;
};

export type WarmupGroup = {
  leadCount: number;
  mode: "none" | "rows" | "notes";
  parentId: string | null;
  movements: WarmupMovement[];
};

type WarmupExerciseLike = {
  id: string;
  name: string;
  notes?: string | null;
  coachNotes?: string | null;
  description?: string | null;
  videoUrl?: string | null;
  setScheme?: string | null;
  reps?: string | null;
  setCount?: number;
};

function blobFor(ex: WarmupExerciseLike): string {
  return [ex.notes, ex.coachNotes, ex.description].filter(Boolean).join("\n");
}

function movementFromRow(ex: WarmupExerciseLike): WarmupMovement {
  const timed = isTimedApproach(ex.setScheme);
  const holdSeconds = resolveExerciseHoldSeconds({
    setScheme: ex.setScheme,
    reps: ex.reps,
    setCount: ex.setCount,
    timedApproach: timed,
  });
  return {
    key: ex.id,
    blockId: ex.id,
    setNum: 1,
    name: ex.name,
    label: shortWarmupLabel(ex.name),
    videoUrl: resolveExerciseVideoUrl({
      name: ex.name,
      videoUrl: ex.videoUrl ?? null,
    }),
    description: ex.description || ex.coachNotes || null,
    setScheme: timed ? "timed" : ex.setScheme || "standard",
    reps: ex.reps ?? null,
    setCount: Math.max(1, ex.setCount || 1),
    holdSeconds,
  };
}

/**
 * Present either stored shape as one Warm-up card.
 * rows  = leading tagged WorkoutExercise lines (seed / AI lesson plan)
 * notes = one "Warm-up" line whose notes list the movements (SMS parser)
 */
export function resolveWarmupGroup(exercises: WarmupExerciseLike[]): WarmupGroup {
  const leadCount = leadingWarmupCount(exercises);
  if (leadCount <= 0) {
    return { leadCount: 0, mode: "none", parentId: null, movements: [] };
  }

  const lead = exercises.slice(0, leadCount);
  const first = lead[0];
  const parsedNotes = parseWarmupNoteMovements(blobFor(first));
  const genericWarmupName =
    /^warm[- ]?up(\s*\(.*\))?$/i.test(first.name.trim()) ||
    /^warm[- ]?up$/i.test(shortWarmupLabel(first.name));
  const looksLikeBlob = leadCount === 1 && genericWarmupName && parsedNotes.length >= 2;

  if (looksLikeBlob) {
    return {
      leadCount: 1,
      mode: "notes",
      parentId: first.id,
      movements: parsedNotes.map((line, i) => ({
        key: `${first.id}:${i + 1}`,
        blockId: first.id,
        setNum: i + 1,
        name: line.name,
        label: shortWarmupLabel(line.name),
        videoUrl: resolveExerciseVideoUrl({ name: line.name, videoUrl: null }),
        description: line.reps
          ? line.timed
            ? line.reps
            : `${line.reps} reps`
          : null,
        setScheme: line.timed ? "timed" : "standard",
        reps: line.reps,
        setCount: 1,
        holdSeconds: line.holdSeconds,
      })),
    };
  }

  return {
    leadCount,
    mode: "rows",
    parentId: first.id,
    movements: lead.map((ex) => movementFromRow(ex)),
  };
}

export function isWarmupMovementDone(
  movement: WarmupMovement,
  finishedExercises: ReadonlySet<string>,
  completedSets: Record<string, ReadonlySet<number> | undefined>,
): boolean {
  const done = completedSets[movement.blockId];
  if (done?.has(movement.setNum)) return true;
  // Logged complete with no per-set checkoffs — show every movement done.
  if (finishedExercises.has(movement.blockId) && (!done || done.size === 0)) {
    return true;
  }
  return false;
}
