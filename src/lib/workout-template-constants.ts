/**
 * Suggested starter categories only — coaches can type **any** freeform category
 * (yoga, meditation, eating, martial arts, dog training, …). Never treat this list
 * as exhaustive. New categories appear in the picker after first use.
 */
export const TEMPLATE_CATEGORY_SUGGESTIONS = [
  "general",
  "adult",
  "athletes",
  "youth",
  "yoga",
  "meditation",
  "nutrition",
  "eating",
  "martial-arts",
  "combat",
  "dog-training",
  "mobility",
  "recovery",
  "cardio",
  "home",
  "gym",
] as const;

/**
 * Day / session name chips when saving a template.
 * Drawn from how Jeremy actually titles workouts on prod (Adult + Athletes).
 * Coaches can still type any freeform name.
 */
export const TEMPLATE_DAY_NAME_SUGGESTIONS = [
  "Upper Body Workout",
  "Lower Body Workout",
  "Leg Day",
  "Fasted Cardio",
  "Split Routine Chest/Shoulders/Triceps",
  "Back/Bicep",
  "Shoulder/Tricep/Ab/Calves",
  "Rest Day",
  "Upper Body Warm Up and Strength",
  "Active Recovery",
] as const;

/** @deprecated Use TEMPLATE_CATEGORY_SUGGESTIONS — categories are freeform. */
export const TEMPLATE_CATEGORIES = TEMPLATE_CATEGORY_SUGGESTIONS;
