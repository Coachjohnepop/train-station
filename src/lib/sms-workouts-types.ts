export type SmsWorkoutRecord = {
  id: string;
  name: string;
  description?: string;
  source: "sms";
  createdAt: string;
  restTimerEnabled?: boolean;
  restTimerSeconds?: number;
  /** whistle | bell | buzzer | cybertruck */
  restTimerSound?: string;
  exportText?: string | null;
  certifiedAt?: string | null;
};

export type SmsWorkoutExerciseRecord = {
  id: string;
  workoutId: string;
  exerciseId: string;
  blockName?: string | null;
  sortOrder: number;
  sets: number | null;
  reps: string | null;
  notes: string | null;
  setScheme: string | null;
  weightTier: string | null;
};

export type SmsWorkoutStore = {
  workouts: SmsWorkoutRecord[];
  workoutExercises: SmsWorkoutExerciseRecord[];
};

export function emptySmsWorkoutStore(): SmsWorkoutStore {
  return { workouts: [], workoutExercises: [] };
}