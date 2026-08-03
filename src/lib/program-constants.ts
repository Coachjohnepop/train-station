export const DAYS_PER_WEEK = 7;

/** Default coach-facing program cycle (4 weeks × 7 days). */
export const PROGRAM_CYCLE_DAYS = 28;
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Default catalog art (repo static files). Prefer Program.coverUrl when set in DB/admin. */
export const PROGRAM_IMAGES: Record<string, string> = {
  adult: "/images/programs/adult.jpg",
  "strength-training": "/images/programs/strength.jpg",
  "boot-camp-preparation": "/images/programs/bootcamp.jpg",
  "mom-dads-little-time": "/images/programs/mom-dads.jpg",
  "youth-sports": "/images/programs/youth-training.jpg",
  /** Jeremy seminar / keynote photo */
  speaking: "/images/programs/speaking.jpg",
  speaking_fee: "/images/programs/speaking.jpg",
  /** Services & extras cards (#services) */
  team_consultation: "/images/services/team-consultation.jpg",
  custom_training: "/images/services/custom-training.jpg",
  merchandise: "/images/services/merchandise-gear-collage.jpg",
};

/** Resolve card art: coach-uploaded coverUrl wins over static defaults. */
export function resolveProgramImage(
  slug: string,
  coverUrl?: string | null,
): string {
  const custom = coverUrl?.trim();
  if (custom) return custom;
  return PROGRAM_IMAGES[slug] || "/images/programs/adult.jpg";
}

export const CATEGORY_LABELS: Record<string, string> = {
  workout: "Workouts",
  // eating: "Eating Approaches", // coming soon
  yoga: "Yoga Channels",
  journey: "Journeys",
};