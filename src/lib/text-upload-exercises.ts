export const NEWLY_ADDED_EXERCISE_TAG = "newly-added";

export function isNewlyAddedFromTextUpload(exercise: {
  tags?: string | null;
  description?: string | null;
}): boolean {
  const tags = (exercise.tags || "").toLowerCase();
  const desc = (exercise.description || "").toLowerCase();
  return (
    tags.includes(NEWLY_ADDED_EXERCISE_TAG) ||
    tags.includes("sms-import") ||
    desc.includes("created from text upload") ||
    desc.includes("created from sms workout")
  );
}