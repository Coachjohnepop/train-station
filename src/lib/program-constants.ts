export const DAYS_PER_WEEK = 7;

/** Default coach-facing program cycle (4 weeks × 7 days). */
export const PROGRAM_CYCLE_DAYS = 28;
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const PROGRAM_IMAGES: Record<string, string> = {
  adult: "/images/programs/adult.jpg",
  "strength-training": "/images/programs/strength.jpg",
  "boot-camp-preparation": "/images/programs/bootcamp.jpg",
  "mom-dads-little-time": "/images/programs/mom-dads.jpg",
  "youth-sports": "/images/programs/youth-training.jpg",
};

export const CATEGORY_LABELS: Record<string, string> = {
  workout: "Workouts",
  // eating: "Eating Approaches", // coming soon
  yoga: "Yoga Channels",
  journey: "Journeys",
};