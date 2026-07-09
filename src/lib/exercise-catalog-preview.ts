import "server-only";

import { loadExerciseCatalogForMatching } from "@/lib/exercise-catalog-load";
import type {
  ExerciseCatalogMatchPreview,
  WorkoutCatalogPreview,
} from "@/lib/exercise-catalog-preview-types";
import {
  matchExerciseInCatalog,
  normalizeExerciseName,
  sanitizeSmsExerciseName,
} from "@/lib/exercise-match";
import type { ParsedSmsWorkout } from "@/lib/sms-workout-parser";

export type { ExerciseCatalogMatchPreview, WorkoutCatalogPreview } from "@/lib/exercise-catalog-preview-types";

export async function previewWorkoutCatalogMatches(
  workout: ParsedSmsWorkout,
): Promise<WorkoutCatalogPreview> {
  const catalog = await loadExerciseCatalogForMatching();
  const rows: ExerciseCatalogMatchPreview[] = [];
  let matched = 0;
  let newCount = 0;
  let noteBlocks = 0;

  for (const ex of workout.exercises) {
    if (ex.section === "notes") {
      rows.push({
        parsedName: ex.name,
        section: "notes",
        status: "note",
        catalogId: null,
        catalogName: null,
        nameDiffers: false,
        hasVideo: false,
      });
      noteBlocks++;
      continue;
    }

    const displayName = sanitizeSmsExerciseName(ex.name) || ex.name.trim();
    const hit = matchExerciseInCatalog(displayName, catalog);
    if (hit) {
      rows.push({
        parsedName: ex.name,
        section: ex.section || "main",
        status: "matched",
        catalogId: hit.id,
        catalogName: hit.name,
        nameDiffers: normalizeExerciseName(hit.name) !== normalizeExerciseName(displayName),
        hasVideo: Boolean(hit.videoUrl?.trim()),
      });
      matched++;
    } else {
      rows.push({
        parsedName: ex.name,
        section: ex.section || "main",
        status: "new",
        catalogId: null,
        catalogName: null,
        nameDiffers: false,
        hasVideo: false,
      });
      newCount++;
    }
  }

  return {
    rows,
    summary: {
      total: rows.length,
      matched,
      newCount,
      noteBlocks,
    },
  };
}