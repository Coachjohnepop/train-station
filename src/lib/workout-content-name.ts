import { isGymLabel, isHomeLabel } from "@/lib/program-calendar";

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

  result = result.replace(/\s*\((gym|home)\)\s*$/i, "");
  result = result.replace(/\s*[-–—]\s*(gym|home)\s*$/i, "");
  result = result.replace(/\s+(gym|home)\s*$/i, "");
  result = result.replace(/\s{2,}/g, " ").trim();

  return result;
}

/** Display / library title — content only, no day index or location. */
export function workoutContentTitle(name: string | null | undefined): string {
  return (
    stripLocationSuffixFromWorkoutName(stripDayPrefixFromWorkoutName(name || "")) ||
    "Workout"
  );
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