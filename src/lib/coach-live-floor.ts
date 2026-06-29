import "server-only";

import { resolveDemoUser } from "@/lib/demo-user-directory";
import {
  getLiveWorkoutSession,
  normalizeLiveSessionDate,
  type LiveWorkoutSession,
} from "@/lib/live-workout-session";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { getWorkoutExercisePreview } from "@/lib/sms-generated-workouts";
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

function countSets(session: LiveWorkoutSession | null, exerciseCount: number): {
  setsCompleted: number;
  setsTotal: number;
  exercisesDone: number;
} {
  if (!session) {
    return { setsCompleted: 0, setsTotal: Math.max(exerciseCount * 3, 0), exercisesDone: 0 };
  }
  let setsCompleted = 0;
  for (const nums of Object.values(session.completedSets)) {
    setsCompleted += nums.length;
  }
  const exercisesDone = session.finishedExercises.length;
  const setsTotal = Math.max(exerciseCount * 3, setsCompleted, 1);
  return { setsCompleted, setsTotal, exercisesDone };
}

function liveSetsCompleted(session: LiveWorkoutSession | null): number {
  if (!session) return 0;
  let n = 0;
  for (const nums of Object.values(session.completedSets)) n += nums.length;
  return n;
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

async function resolveMemberName(userId: string): Promise<string> {
  const demo = resolveDemoUser(userId);
  if (demo?.name) return demo.name;
  const profile = await getMemberProfile(userId);
  if (profile?.email) {
    const local = profile.email.split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return userId;
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
    const preview = await getWorkoutExercisePreview(todaySession.workoutId);
    const exercisesTotal = preview.length;

    for (const userId of todaySession.userIds) {
      const dedupeKey = `${userId}:${todaySession.workoutId}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const live = await getLiveWorkoutSession({
        userId,
        workoutId: todaySession.workoutId,
        sessionDate: date,
      });

      const { setsCompleted: setsDone, setsTotal, exercisesDone } = countSets(live, exercisesTotal);
      const activeExercise = preview[exercisesDone] ?? preview[0] ?? null;

      tiles.push({
        userId,
        name: await resolveMemberName(userId),
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