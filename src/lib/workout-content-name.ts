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