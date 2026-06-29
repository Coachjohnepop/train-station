import "server-only";

import {
  GAMIFICATION_EVENT_LABELS,
  GAMIFICATION_POINTS,
  type GamificationEvent,
  type GamificationEventType,
  type MemberScoreProgress,
  type ScoreMilestone,
  type UserGamification,
} from "@/lib/gamification-types";
import {
  awardGamificationPoints,
  getUserGamification,
} from "@/lib/member-gamification-store";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { hydrateJsonStore, isBlobConfigured } from "@/lib/demo-json-blob";
import path from "path";
import type { WarmupProgressEntry } from "@/lib/member-warmup-progress-store";

const JOURNEY_MILESTONES: Array<{
  id: string;
  type: GamificationEventType;
  points: number;
  earnHint: string;
  href: string;
  isComplete: (events: GamificationEvent[], profile: Awaited<ReturnType<typeof getMemberProfile>>) => {
    complete: boolean;
    completedAt: string | null;
    earnedPoints: number;
  };
}> = [
  {
    id: "onboarding:complete",
    type: "onboarding_complete",
    points: GAMIFICATION_POINTS.onboarding_complete,
    earnHint: "Finish account setup during onboarding.",
    href: "/member/onboard",
    isComplete: (events, profile) => {
      const event = events.find((e) => e.id === "onboarding:complete" || e.type === "onboarding_complete");
      if (event) return { complete: true, completedAt: event.at, earnedPoints: event.points };
      if (profile?.onboardingComplete) {
        return {
          complete: true,
          completedAt: profile.completedAt,
          earnedPoints: GAMIFICATION_POINTS.onboarding_complete,
        };
      }
      return { complete: false, completedAt: null, earnedPoints: 0 };
    },
  },
  {
    id: "warmup:first",
    type: "warmup_before_live",
    points: GAMIFICATION_POINTS.warmup_before_live,
    earnHint: "Check off warm-ups on Today before your live session (once per day).",
    href: "/member/today",
    isComplete: (events) => {
      const warmupEvents = events.filter((e) => e.type === "warmup_before_live");
      if (!warmupEvents.length) {
        return { complete: false, completedAt: null, earnedPoints: 0 };
      }
      const latest = [...warmupEvents].sort((a, b) => b.at.localeCompare(a.at))[0];
      return {
        complete: true,
        completedAt: latest.at,
        earnedPoints: warmupEvents.reduce((sum, e) => sum + e.points, 0),
      };
    },
  },
  {
    id: "intake:scheduled",
    type: "intake_scheduled",
    points: GAMIFICATION_POINTS.intake_scheduled,
    earnHint: "Book your 15-minute intro from Today or Book Call.",
    href: "/member/today",
    isComplete: (events, profile) => {
      const event = events.find((e) => e.id === "intake:scheduled" || e.type === "intake_scheduled");
      if (event) return { complete: true, completedAt: event.at, earnedPoints: event.points };
      if (profile?.introBookedAt) {
        return {
          complete: true,
          completedAt: profile.introBookedAt,
          earnedPoints: GAMIFICATION_POINTS.intake_scheduled,
        };
      }
      return { complete: false, completedAt: null, earnedPoints: 0 };
    },
  },
  {
    id: "intake:complete",
    type: "intake_complete",
    points: GAMIFICATION_POINTS.intake_complete,
    earnHint: "Coach marks intake complete after your intro call.",
    href: "/member/today",
    isComplete: (events, profile) => {
      const event = events.find((e) => e.type === "intake_complete");
      if (event) return { complete: true, completedAt: event.at, earnedPoints: event.points };
      if (profile?.coachIntakeCompleteAt) {
        return {
          complete: true,
          completedAt: profile.coachIntakeCompleteAt,
          earnedPoints: GAMIFICATION_POINTS.intake_complete,
        };
      }
      return { complete: false, completedAt: null, earnedPoints: 0 };
    },
  },
];

const WARMUP_BLOB = "demo/member-warmup-progress.json";
const WARMUP_DEV = path.join(process.cwd(), "prisma", "member-warmup-progress.dev.json");
let warmupMemory: Record<string, WarmupProgressEntry> | null = null;

async function listWarmupProgressForUser(userId: string): Promise<WarmupProgressEntry[]> {
  const store = await hydrateJsonStore({
    blobPath: WARMUP_BLOB,
    localPath: WARMUP_DEV,
    memory: warmupMemory,
    setMemory: (v) => {
      warmupMemory = (v as Record<string, WarmupProgressEntry>) || {};
    },
    fallback: () => ({}),
    preferFresh: isBlobConfigured(),
  });
  warmupMemory = store as Record<string, WarmupProgressEntry>;
  const prefix = `${userId}::`;
  return Object.entries(store)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, entry]) => entry as WarmupProgressEntry)
    .filter((entry) => Boolean(entry?.userId));
}

/** Backfill missing ledger events from profile / warmup progress (admin/migration only — never on GET). */
export async function reconcileGamificationFromProfile(userId: string): Promise<UserGamification> {
  const profile = await getMemberProfile(userId);
  const gamification = await getUserGamification(userId);
  const has = (predicate: (e: GamificationEvent) => boolean) =>
    gamification.events.some(predicate);

  if (profile?.onboardingComplete && !has((e) => e.id === "onboarding:complete")) {
    await awardGamificationPoints({
      userId,
      eventId: "onboarding:complete",
      type: "onboarding_complete",
      label: GAMIFICATION_EVENT_LABELS.onboarding_complete,
      programSlug: "adult",
    });
  }

  if (profile?.introBookedAt && !has((e) => e.id === "intake:scheduled")) {
    await awardGamificationPoints({
      userId,
      eventId: "intake:scheduled",
      type: "intake_scheduled",
      label: GAMIFICATION_EVENT_LABELS.intake_scheduled,
    });
  }

  if (profile?.coachIntakeCompleteAt && !has((e) => e.type === "intake_complete")) {
    await awardGamificationPoints({
      userId,
      eventId: `intake:complete:${profile.coachIntakeCompleteAt}`,
      type: "intake_complete",
      label: GAMIFICATION_EVENT_LABELS.intake_complete,
    });
  }

  const warmups = await listWarmupProgressForUser(userId);
  for (const entry of warmups) {
    if (!entry.coachNotifiedAt) continue;
    const eventId = `warmup:${entry.sessionDate}`;
    if (has((e) => e.id === eventId)) continue;
    await awardGamificationPoints({
      userId,
      eventId,
      type: "warmup_before_live",
      label: GAMIFICATION_EVENT_LABELS.warmup_before_live,
    });
  }

  return getUserGamification(userId);
}

export function buildMemberScoreProgress(
  gamification: UserGamification,
  profile: Awaited<ReturnType<typeof getMemberProfile>>,
): MemberScoreProgress {
  const events = gamification.events;
  const earnedPoints = events.reduce((sum, e) => sum + e.points, 0);

  const milestones: ScoreMilestone[] = JOURNEY_MILESTONES.map((def) => {
    const state = def.isComplete(events, profile);
    return {
      id: def.id,
      type: def.type,
      label: GAMIFICATION_EVENT_LABELS[def.type],
      points: def.points,
      status: state.complete ? "complete" : "incomplete",
      earnedPoints: state.complete ? state.earnedPoints || def.points : 0,
      completedAt: state.completedAt,
      earnHint: def.earnHint,
      href: def.href,
    };
  });

  const workoutEvents = events.filter((e) => e.type === "workout_logged");
  const workoutEarned = workoutEvents.reduce((sum, e) => sum + e.points, 0);

  milestones.push({
    id: "workout:next",
    type: "workout_logged",
    label: GAMIFICATION_EVENT_LABELS.workout_logged,
    points: GAMIFICATION_POINTS.workout_logged,
    status: "incomplete",
    earnedPoints: workoutEarned,
    completedAt: workoutEvents.length
      ? [...workoutEvents].sort((a, b) => b.at.localeCompare(a.at))[0].at
      : null,
    repeatable: true,
    earnHint: "Log a workout from Today — +25 pts once per scheduled workout per day.",
    href: "/member/today",
  });

  const availablePoints = milestones
    .filter((m) => m.status === "incomplete" && !m.repeatable)
    .reduce((sum, m) => sum + m.points, 0);

  const maxRampPoints = JOURNEY_MILESTONES.reduce((sum, m) => sum + m.points, 0);

  return {
    earnedPoints,
    availablePoints,
    maxRampPoints,
    milestones,
    workoutLogs: {
      count: workoutEvents.length,
      earnedPoints: workoutEarned,
      nextPoints: GAMIFICATION_POINTS.workout_logged,
    },
  };
}