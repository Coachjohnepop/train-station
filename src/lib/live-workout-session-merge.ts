/**
 * Member refresh often omits baseRevision (client refs reset to 0). Treat that
 * as stale vs a newer coach row so a cached PUT cannot wipe floor checkoffs.
 */
export function isStaleMemberVsCoachWrite(input: {
  updatedBy: "coach" | "member";
  baseRevision: number | null;
  existingUpdatedBy?: "coach" | "member";
  existingRevision: number;
}): boolean {
  if (input.updatedBy !== "member") return false;
  if (input.existingUpdatedBy !== "coach") return false;
  if (input.existingRevision <= 0) return false;
  if (input.baseRevision == null) return true;
  return input.existingRevision > input.baseRevision;
}
