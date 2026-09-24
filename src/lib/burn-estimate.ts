/**
 * Rough calorie burn. kcal = MET × kg × hours.
 * Activity sentences and workout sessions share this math.
 */

const WORD_COUNTS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
};

export function poundsToKg(pounds: number): number {
  return pounds * 0.45359237;
}

export function metCalories(met: number, weightLbs: number, hours: number): number {
  if (met <= 0 || weightLbs <= 0 || hours <= 0) return 0;
  return Math.round(met * poundsToKg(weightLbs) * hours);
}

function countBefore(text: string, unit: RegExp): number | null {
  const match = text.match(new RegExp(`(\\d+|${Object.keys(WORD_COUNTS).join("|")})\\s*(?:full\\s+)?${unit.source}`, "i"));
  if (!match) return null;
  const raw = match[1].toLowerCase();
  const value = /^\d+$/.test(raw) ? Number(raw) : WORD_COUNTS[raw];
  return value && value > 0 ? value : null;
}

/** Free-text activity. Returns null when the sentence has no movement we can price. */
export function estimateActivityBurn(text: string, weightLbs: number): number | null {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length < 3) return null;

  if (/golf|holes?/i.test(line)) {
    const holes = countBefore(line, /holes?/) ?? (/nine|9/.test(line) ? 9 : 9);
    const hours = holes <= 9 ? 2 : 4;
    const met = /hill/i.test(line) ? 5 : 4.5;
    return metCalories(met, weightLbs, hours * (holes > 9 ? 1 : holes / 9));
  }

  if (/wheel\s*barrow|dirt|loads?/i.test(line) && /load/i.test(line)) {
    const loads = countBefore(line, /loads?/) ?? 1;
    const minutes = Math.min(180, Math.max(10, loads * 2.5));
    return metCalories(6, weightLbs, minutes / 60);
  }

  const hours = countBefore(line, /hours?|hrs?/);
  const minutes = countBefore(line, /minutes?|mins?/);
  const durationHours = hours ?? (minutes != null ? minutes / 60 : null);
  if (durationHours == null) return null;

  let met = 3.5;
  if (/stretch|mobility|yoga/i.test(line)) met = 2.5;
  else if (/bike|cycle|cycling/i.test(line)) met = 6.5;
  else if (/run|jog/i.test(line)) met = 8;
  else if (/horse/i.test(line)) met = 5.5;
  else if (/ice\s*skat|skate/i.test(line)) met = /leisure|easy|slow/i.test(line) ? 5.5 : 7;
  else if (/ski/i.test(line)) met = /cross[\s-]?country/i.test(line) ? 8 : 6;
  else if (/zoo|stroll/i.test(line)) met = 3.3;
  else if (/fasted|cardio|brisk/i.test(line)) met = 6.5;
  else if (/walk/i.test(line)) met = 3.8;
  return metCalories(met, weightLbs, durationHours);
}

export type SessionPiece = {
  name: string;
  sets?: number | null;
  reps?: string | null;
  durationSec?: number | null;
};

function minutesInText(text: string): number | null {
  const match = text.match(/(\d+)\s*(?:-|–|to)?\s*(\d+)?\s*mins?/i);
  if (!match) return null;
  const low = Number(match[1]);
  const high = match[2] ? Number(match[2]) : low;
  const minutes = (low + high) / 2;
  return minutes > 0 ? minutes : null;
}

function metForMovement(name: string): number {
  const line = name.toLowerCase();
  if (/stretch|mobility|cool down|yoga|rest day/.test(line)) return 2.5;
  if (/jump rope|sprint|\brun\b|jog|mile/.test(line)) return 8;
  if (/jump squat|burpee|plyo/.test(line)) return 8;
  if (/bike|cycle|\brow\b/.test(line)) return 7;
  if (/walk|treadmill|fasted cardio|\bcardio\b/.test(line)) return 5.5;
  if (/warm/.test(line)) return 3.5;
  return 5;
}

function steadyCardio(name: string): boolean {
  return /walk|treadmill|fasted cardio|\bcardio\b|bike|cycle|\brow\b/.test(name.toLowerCase());
}

function pieceMinutes(piece: SessionPiece): number {
  if (piece.durationSec && piece.durationSec > 0) return piece.durationSec / 60;
  const written = minutesInText(`${piece.name} ${piece.reps ?? ""}`);
  if (written) return written;
  const label = piece.name.toLowerCase();
  if (/\bmile\b/.test(label)) return 10;
  if (/warm/.test(label)) return 6;
  if (steadyCardio(label)) return 30;
  const sets = piece.sets && piece.sets > 0 ? piece.sets : 3;
  return sets * 2.5;
}

/** One logged session. Steady cardio is counted once; strength work adds up. */
export function estimateSessionBurn(input: {
  name: string;
  weightLbs: number;
  pieces: SessionPiece[];
  progress?: number;
}): number {
  const titleMinutes = minutesInText(input.name);
  let calories = 0;
  if (titleMinutes && /cardio|walk|run|bike|row|ski/.test(input.name.toLowerCase())) {
    calories = metCalories(metForMovement(input.name), input.weightLbs, titleMinutes / 60);
  } else if (/^\s*rest\b/i.test(input.name) && input.pieces.length === 0) {
    calories = 0;
  } else {
    let steady = 0;
    for (const piece of input.pieces) {
      const minutes = pieceMinutes(piece);
      const burned = metCalories(metForMovement(piece.name), input.weightLbs, minutes / 60);
      if (steadyCardio(piece.name)) steady = Math.max(steady, burned);
      else calories += burned;
    }
    calories += steady;
  }
  if (calories <= 0 && !/rest/i.test(input.name)) {
    calories = estimateWorkoutBurn({ name: input.name, weightLbs: input.weightLbs, minutes: 45 });
  }
  const scale = input.progress == null ? 1 : Math.min(1, Math.max(0, input.progress / 100));
  return Math.round(calories * (scale || 1));
}

export function estimateWorkoutBurn(input: {
  name: string;
  weightLbs: number;
  minutes: number;
  progress?: number;
}): number {
  const name = input.name.toLowerCase();
  let met = 5;
  if (/cardio|run|row|bike|conditioning/.test(name)) met = 7;
  else if (/stretch|mobility|recovery|yoga/.test(name)) met = 2.5;
  const hours = Math.min(150, Math.max(15, input.minutes)) / 60;
  const scale = input.progress == null ? 1 : Math.min(1, Math.max(0, input.progress / 100));
  return metCalories(met, input.weightLbs, hours * (scale || 1));
}

/** Minutes from set counts and rest. A session with no sets is 45 minutes. */
export function workoutMinutes(
  exercises: { setCount?: number | null; sets?: number | null; restBetweenSetsSec?: number | null }[],
): number {
  if (exercises.length === 0) return 45;
  let minutes = 0;
  for (const exercise of exercises) {
    const sets = exercise.setCount || exercise.sets || 3;
    const restSec = exercise.restBetweenSetsSec ?? 60;
    minutes += sets * (0.75 + restSec / 60);
  }
  return Math.round(Math.min(120, Math.max(20, minutes)));
}
