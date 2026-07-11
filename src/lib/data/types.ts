/**
 * Narrow, stable types for user-specific mutable state.
 * These are the contract for the UserData layer (preview JSON today, Prisma tomorrow).
 * Used by member-context, logging, equipment, reports, etc.
 *
 * Goal: one place to evolve the shape, and a single switch point between demo and real.
 */

export type TrainingLocation = "gym" | "home";

export type EnrollmentPosition = {
  currentWeek: number;
  currentDay: number;
  currentPhase?: number;
  trainingLocation?: TrainingLocation;
  /** YYYY-MM-DD — member-chosen day 1 of paid block. */
  programStartDate?: string | null;
  blockEndsAt?: string | null;
};

export type UserEnrollment = {
  slug: string;
  currentWeek: number;
  currentDay: number;
  currentPhase?: number;
  trainingLocation?: TrainingLocation;
};

export type EnrollmentsMap = Record<string, EnrollmentPosition>;

export type DemoWorkoutLog = {
  id: string;
  userId: string;
  workoutId: string;
  performedAt: string;
  completed: boolean;
  progress: number;
};

export type DemoExercisePerformance = {
  id: string;
  userId: string;
  exerciseId: string;
  workoutExerciseId?: string | null;
  setScheme: string;
  weightTier: string;
  startingWeightLbs?: number | null;
  performedAt: string;
  repPattern?: string | null;
  reps?: string | null;
  sets?: number | null;
  repsCompleted?: number | null;
  setsCompleted?: number | null;
};

export type UserEquipmentItem = {
  equipmentId: string;
  hasAtHome: boolean;
  quantity?: number;
  notes?: string;
};

export type UserReminderSettings = {
  phone: string | null;
  dailyReminderTime: string | null; // "HH:MM"
};

/**
 * Input shape for one exercise in a workout log (from MemberWorkoutConsole payload).
 * Mirrors the zod logExerciseSchema in the log route.
 */
export type LogExerciseInput = {
  workoutExerciseId?: string;
  exerciseId: string;
  setScheme: string;
  repPattern?: string | null;
  reps?: string | null;
  sets?: number | null;
  weightTier: string;
  startingWeightLbs?: number | null;
  repsCompleted?: number | null;
  setsCompleted?: number | null;
};

/**
 * Uniform result returned after creating a workout log (and optional perfs + advance).
 * Used by the log API route and (in future) other callers.
 * Matches what the console currently expects in the response.
 */
export type CreateLogResult = {
  ok: true;
  logId: string;
  performances: number;
  performedAt: string;
  progress: number;
  completed: boolean;
};
