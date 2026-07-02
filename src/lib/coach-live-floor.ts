import "server-only";

import { resolveCoachMemberName } from "@/lib/coach-roster";
import {
  getLiveWorkoutSession,
  normalizeLiveSessionDate,
  type LiveWorkoutSession,
} from "@/lib/live-workout-session";

import {
  getWorkoutExerciseBlocks,
  getWorkoutExercisePreview,
  type WorkoutExerciseBlockMeta,
} from "@/lib/sms-generated-workouts";
import { getSessionsForDate, hydrateTodaySessions } from "@/lib/today-sessions";

export type LiveFloorTile = {
  userId: string;
  name: string;
  workoutId: string;
  workoutTitle: string;
  sessionDate: string;
  scheduledAt: string;
  exercisePreview: string[];
  activeExercise: string | null;
  setsCompleted: number;
  setsTotal: number;
  exercisesDone: number;
  exercisesTotal: number;
  status: "waiting" | "active" | "done";
  checkoffHref: string;
  liveRevision: number;
};

function exerciseIsDone(
  block: WorkoutExerciseBlockMeta,
  session: LiveWorkoutSession,
): boolean {
  if (session.finishedExercises.includes(block.id)) return true;
  const nums = session.completedSets[block.id] ?? [];
  if (nums.length === 0) return false;
  return new Set(nums).size >= Math.max(1, block.setCount);
}

function countExercisesDone(
  session: LiveWorkoutSession | null,
  blocks: WorkoutExerciseBlockMeta[],
): number {
  if (!session || blocks.length === 0) return 0;
  return blocks.filter((block) => exerciseIsDone(block, session)).length;
}

function countSets(
  session: LiveWorkoutSession | null,
  plannedSetsTotal: number,
  exercisesTotal: number,
  blocks: WorkoutExerciseBlockMeta[],
): {
  setsCompleted: number;
  setsTotal: number;
  exercisesDone: number;
} {
  if (!session) {
    return {
      setsCompleted: 0,
      setsTotal: Math.max(plannedSetsTotal, exercisesTotal * 3, 1),
      exercisesDone: 0,
    };
  }
  let setsCompleted = 0;
  for (const nums of Object.values(session.completedSets)) {
    setsCompleted += nums.length;
  }
  const exercisesDone = countExercisesDone(session, blocks);
  const setsTotal = Math.max(plannedSetsTotal, setsCompleted, 1);
  return { setsCompleted, setsTotal, exercisesDone };
}

function liveSetsCompleted(session: LiveWorkoutSession | null): number {
  if (!session) return 0;
  let n = 0;
  for (const nums of Object.values(session.completedSets)) n += nums.length;
  return n;
}

function resolveActiveExerciseName(
  blocks: WorkoutExerciseBlockMeta[],
  live: LiveWorkoutSession | null,
  exercisesDone: number,
): string | null {
  if (blocks.length === 0) return null;

  if (live?.activeId) {
    const active = blocks.find((b) => b.id === live.activeId);
    if (active) return active.name;
  }

  if (live?.finishedExercises?.length) {
    const finished = new Set(live.finishedExercises);
    const next = blocks.find((b) => !finished.has(b.id));
    if (next) return next.name;
  }

  return blocks[Math.min(exercisesDone, blocks.length - 1)]?.name ?? blocks[0]?.name ?? null;
}

function tileStatus(
  session: LiveWorkoutSession | null,
  exercisesDone: number,
  exercisesTotal: number,
): LiveFloorTile["status"] {
  if (exercisesTotal > 0 && exercisesDone >= exercisesTotal) return "done";
  if (session && (session.activeId || liveSetsCompleted(session) > 0)) return "active";
  return "waiting";
}

export async function buildCoachLiveFloor(sessionDate?: string): Promise<{
  sessionDate: string;
  tiles: LiveFloorTile[];
  assignedCount: number;
}> {
  const date = normalizeLiveSessionDate(sessionDate);
  await hydrateTodaySessions({ preferFresh: true });
  const daySessions = getSessionsForDate(date);

  const tiles: LiveFloorTile[] = [];
  const seen = new Set<string>();

  for (const todaySession of daySessions) {
    const blocks = await getWorkoutExerciseBlocks(todaySession.workoutId);
    const preview = blocks.map((b) => b.name);
    const exercisesTotal = blocks.length;

    for (const userId of todaySession.userIds) {
      const dedupeKey = `${userId}:${todaySession.workoutId}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const live = await getLiveWorkoutSession({
        userId,
        workoutId: todaySession.workoutId,
        sessionDate: date,
      });

      const plannedSets = blocks.reduce((sum, b) => sum + b.setCount, 0);
      const { setsCompleted: setsDone, setsTotal, exercisesDone } = countSets(
        live,
        plannedSets,
        exercisesTotal,
        blocks,
      );
      const activeExercise = resolveActiveExerciseName(blocks, live, exercisesDone);

      tiles.push({
        userId,
        name: await resolveCoachMemberName(userId),
        workoutId: todaySession.workoutId,
        workoutTitle: todaySession.title,
        sessionDate: date,
        scheduledAt: todaySession.scheduledAt,
        exercisePreview: preview,
        activeExercise,
        setsCompleted: setsDone,
        setsTotal,
        exercisesDone,
        exercisesTotal,
        status: tileStatus(live, exercisesDone, exercisesTotal),
        checkoffHref: `/member/today?asInstructor=true&forUser=${encodeURIComponent(userId)}&date=${date}`,
        liveRevision: live?.revision ?? 0,
      });
    }
  }

  tiles.sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  return {
    sessionDate: date,
    tiles,
    assignedCount: tiles.length,
  };
}