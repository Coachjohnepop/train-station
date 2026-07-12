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

/** @deprecated Use TEMPLATE_CATEGORY_SUGGESTIONS — categories are freeform. */
export const TEMPLATE_CATEGORIES = TEMPLATE_CATEGORY_SUGGESTIONS;
