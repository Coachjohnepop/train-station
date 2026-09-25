/**
 * Free Explorer product limits — soft teases (see full surface, limited use).
 * Coach Class+ is open for these affordances. Paste/text-upload stays coach-only (API).
 */

import { divisionForPlan } from "@/lib/gamification-levers";
import { normalizeSignupPlan } from "@/lib/signup-plans";

/** How many exercises Free can fully log on an unlocked free day (rest are preview). */
export const FREE_PREVIEW_EXERCISES = 3;

/** Free can post this many member messages in the coach 1:1 before upgrade nudge (still soft). */
export const FREE_COACH_CHAT_SOFT_CAP = 8;

export function isFreeExplorerPlan(plan: string | null | undefined): boolean {
  // A missing plan is not a free ticket. Callers that omit it were locking
  // Business Class behind "Upgrade to Coach Class".
  if (plan == null || !String(plan).trim()) return false;
  return divisionForPlan(normalizeSignupPlan(plan)) === "explorer";
}

/** 0-based exercise index is locked for Free after FREE_PREVIEW_EXERCISES open slots. */
export function isFreePreviewExerciseLocked(exerciseIndex: number, plan: string | null | undefined): boolean {
  if (!isFreeExplorerPlan(plan)) return false;
  return exerciseIndex >= FREE_PREVIEW_EXERCISES;
}

export function freePreviewOpenCount(totalExercises: number): number {
  return Math.min(FREE_PREVIEW_EXERCISES, Math.max(0, totalExercises));
}
