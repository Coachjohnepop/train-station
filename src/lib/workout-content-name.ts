import { isGymLabel, isHomeLabel } from "@/lib/program-calendar";

/**
 * Strip technical IDs / schedule tokens that sometimes leak into Workout.name
 * (e.g. "S1D-1783785459241 W2 Sat Gym" → empty → display as "Workout").
 * Day, week, and Gym/Home belong on ProgramDay / option labels — not the title.
 */
export function stripTechnicalNoiseFromWorkoutName(name: string): string {
  let result = String(name || "").trim();
  if (!result) return result;

  // Auto-generated / demo IDs that should never be coach-facing titles
  result = result.replace(/^s\d+d-\d+\s*/i, "");
  result = result.replace(/^(new-w|w-upload|demo-w|sms-w|demo-we)-\d+(?:-[a-z0-9]+)?\s*/i, "");
  result = result.replace(/\b\d{10,}\b/g, ""); // raw timestamps
  // Week / cycle schedule tokens
  result = result.replace(/\bw(?:eek)?\s*\d+\b/gi, "");
  result = result.replace(/\bm\d+d\d+\b/gi, "");
  result = result.replace(/\bw\d+d\d+\b/gi, "");
  // Weekday names (Mon…Sunday) — shown in the day picker, not the title
  result = result.replace(
    /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    "",
  );
  result = result.replace(/\s{2,}/g, " ").trim();
  result = result.replace(/^[-–—:·|,]+|[-–—:·|,]+$/g, "").trim();
  return result;
}

/**
 * Remove schedule day index from a workout title — day lives on ProgramDay, not Workout.name.
 * "Day 1 Upper Body Workout (Gym)" → "Upper Body Workout (Gym)"
 */
export function stripDayPrefixFromWorkoutName(name: string): string {
  let result = String(name || "").trim();
  if (!result) return result;

  result = result.replace(/^day\s+\d+\s*[-–—:·]\s*/i, "");
  result = result.replace(/^day\s+\d+\s+/i, "");
  result = result.replace(/\s+day\s+\d+\s*$/i, "");
  result = result.replace(/^m\d+d\d+\s*[-–—:·]\s*/i, "");
  result = result.replace(/^w\d+d\d+\s*[-–—:·]\s*/i, "");
  result = result.replace(/\bupper\s+day\s+\d+\b/gi, "Upper body");
  result = result.replace(/\s{2,}/g, " ").trim();

  return result;
}

/** Remove Gym/Home location suffixes — location lives on ProgramDayOption, not Workout.name. */
export function stripLocationSuffixFromWorkoutName(name: string): string {
  let result = String(name || "").trim();
  if (!result) return result;

  // Whole title is only the track label (after schedule noise stripped)
  if (/^(gym|home)$/i.test(result)) return "";

  result = result.replace(/\s*\((gym|home)\)\s*$/i, "");
  result = result.replace(/\s*[-–—]\s*(gym|home)\s*$/i, "");
  result = result.replace(/\s+(gym|home)\s*$/i, "");
  result = result.replace(/\s{2,}/g, " ").trim();
  if (/^(gym|home)$/i.test(result)) return "";

  return result;
}

/** Display / library title — content only, no day index, location, or technical IDs. */
export function workoutContentTitle(name: string | null | undefined): string {
  return (
    stripLocationSuffixFromWorkoutName(
      stripDayPrefixFromWorkoutName(stripTechnicalNoiseFromWorkoutName(name || "")),
    ) || "Workout"
  );
}

/** True when the stored name is schedule/ID noise that should be repaired in the DB. */
export function isGarbageWorkoutTitle(name: string | null | undefined): boolean {
  const raw = String(name || "").trim();
  if (!raw) return true;
  if (/^s\d+d-\d+/i.test(raw)) return true;
  if (/^(new-w|w-upload|demo-w|sms-w)-\d+/i.test(raw)) return true;
  if (/\b\d{10,}\b/.test(raw) && /w\d+|sat|sun|mon|gym|home/i.test(raw)) return true;
  const cleaned = workoutContentTitle(raw);
  // Entire title was noise (e.g. only "W2 Sat Gym" or "Gym")
  if (cleaned === "Workout" && raw.toLowerCase() !== "workout") return true;
  return false;
}

/** Case-insensitive key for matching workout titles in the library. */
export function workoutContentTitleKey(name: string | null | undefined): string {
  return workoutContentTitle(name).trim().toLowerCase();
}

export function workoutsMatchByContentTitle(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return workoutContentTitleKey(a) === workoutContentTitleKey(b);
}

/** Catalog workout.name for the Home track paired with a Gym workout title. */
export function pairedHomeTemplateName(gymWorkoutName: string): string | null {
  const name = String(gymWorkoutName || "").trim();
  if (!name) return null;
  if (/\(Gym\)/i.test(name)) return name.replace(/\(Gym\)/gi, "(Home)");
  if (/\(gym\)/i.test(name)) return name.replace(/\(gym\)/gi, "(home)");
  if (/\s[-–—]\s*Gym\s*$/i.test(name)) return name.replace(/\s[-–—]\s*Gym\s*$/i, " (Home)");
  if (/\sGym\s*$/i.test(name)) return name.replace(/\sGym\s*$/i, " Home");
  return null;
}

export function findPairedHomeTemplateWorkout<
  T extends { id: string; name: string },
>(gymWorkoutName: string, library: readonly T[]): T | null {
  const targetName = pairedHomeTemplateName(gymWorkoutName);
  if (!targetName) return null;
  const exact = library.find((w) => w.name === targetName);
  if (exact) return exact;
  const key = workoutContentTitleKey(targetName);
  return library.find((w) => workoutContentTitleKey(w.name) === key) ?? null;
}

/** Fallback when Gym workout was renamed generically (e.g. "Lower Body Workout"). */
export function findCatalogHomeForProgramDay<
  T extends { id: string; name: string },
>(dayNumber: number, gymWorkoutName: string, library: readonly T[]): T | null {
  const paired = findPairedHomeTemplateWorkout(gymWorkoutName, library);
  if (paired) return paired;

  const dayTag = `Day ${dayNumber} `;
  const homeCandidates = library.filter(
    (w) => w.name.startsWith(dayTag) && /\(Home\)/i.test(w.name),
  );
  if (!homeCandidates.length) return null;

  const gymLower = /lower|leg/i.test(gymWorkoutName);
  const gymUpper = /upper|push|chest|shoulder/i.test(gymWorkoutName);
  if (gymLower) {
    return homeCandidates.find((w) => /lower|leg/i.test(w.name)) ?? null;
  }
  if (gymUpper) {
    return homeCandidates.find((w) => /upper/i.test(w.name)) ?? null;
  }
  return homeCandidates[0] ?? null;
}

/** Default title when coach has not named the workout yet — never embed location. */
export function defaultTrackWorkoutTitle(trackLabel: string): string {
  const label = trackLabel.trim();
  if (/^day\s*off$/i.test(label)) return "Rest day";
  if (/fasted\s*cardio/i.test(label)) return "Fasted cardio";
  if (isGymLabel(label) || isHomeLabel(label)) return "Workout";
  return label || "Workout";
}

/** Name for a cloned copy — preserve content title, never embed calendar day or location. */
export function cloneWorkoutContentName(
  sourceName: string,
  trackLabel?: string,
  opts?: { suffix?: string },
): string {
  const base = workoutContentTitle(sourceName);
  const title = base || defaultTrackWorkoutTitle(trackLabel || "Workout");
  const suffix = opts?.suffix?.trim();
  if (!suffix) return title;
  if (title.toLowerCase().includes(suffix.toLowerCase())) return title;
  return `${title} ${suffix}`;
}