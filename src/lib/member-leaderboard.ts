import "server-only";

import { getUserEnrollments } from "@/lib/data/user-data";
import { JEREMY_MEMBER_IDS } from "@/lib/demo-coach";
import { getDemoWorkoutLogCount } from "@/lib/demo-logs";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { listMemberProfiles } from "@/lib/member-profiles-store";
import { getAllSignInAccounts } from "@/lib/member-accounts-store";
import {
  GAMIFICATION_EVENT_LABELS,
  type LeaderboardPayload,
  type LeaderboardRow,
  type LeaderboardScope,
} from "@/lib/gamification-types";
import {
  awardGamificationPoints,
  getUserGamification,
  listAllGamification,
} from "@/lib/member-gamification-store";

function displayNameForUser(userId: string, fallbackName?: string | null): string {
  const directory = resolveDemoUser(userId);
  if (directory?.name) return directory.name;
  if (fallbackName?.trim()) return fallbackName.trim();
  return userId.startsWith("member-") ? "Member" : "Racer";
}

function bestMoveFromEvents(
  events: Awaited<ReturnType<typeof getUserGamification>>["events"],
): string | null {
  if (!events.length) return null;
  const sorted = [...events].sort((a, b) => b.points - a.points || b.at.localeCompare(a.at));
  const top = sorted[0];
  return GAMIFICATION_EVENT_LABELS[top.type] || top.label;
}

async function primaryProgramSlug(userId: string): Promise<string | null> {
  const enrolls = await getUserEnrollments(userId);
  const slugs = Object.keys(enrolls);
  if (!slugs.length) return "adult";
  return slugs.sort((a, b) => (a === "adult" ? -1 : b === "adult" ? 1 : a.localeCompare(b)))[0];
}

async function discoverParticipantIds(): Promise<Map<string, string | null>> {
  const names = new Map<string, string | null>();

  for (const id of JEREMY_MEMBER_IDS) {
    names.set(id, resolveDemoUser(id)?.name ?? null);
  }

  try {
    const profiles = await listMemberProfiles();
    for (const p of profiles) {
      names.set(p.userId, resolveDemoUser(p.userId)?.name ?? p.email.split("@")[0]);
    }
  } catch {}

  try {
    const accounts = await getAllSignInAccounts();
    for (const [, account] of Object.entries(accounts)) {
      if (account.role !== "MEMBER") continue;
      if (!names.has(account.userId)) {
        names.set(account.userId, account.name ?? null);
      }
    }
  } catch {}

  const ledgers = await listAllGamification();
  for (const row of ledgers) {
    if (!names.has(row.userId)) {
      names.set(row.userId, resolveDemoUser(row.userId)?.name ?? null);
    }
  }

  return names;
}

/** Seed demo racers from workout history when the board is empty. */
async function ensureDemoLeaderboardSeed(): Promise<void> {
  const ledgers = await listAllGamification();
  if (ledgers.some((l) => l.totalPoints > 0)) return;

  for (const userId of JEREMY_MEMBER_IDS) {
    const logs = getDemoWorkoutLogCount(userId);
    if (logs > 0) {
      for (let i = 0; i < logs; i += 1) {
        await awardGamificationPoints({
          userId,
          eventId: `seed-workout:${userId}:${i}`,
          type: "workout_logged",
          programSlug: await primaryProgramSlug(userId),
        });
      }
    }
    if (userId === "demo-user-john-steph") {
      await awardGamificationPoints({
        userId,
        eventId: `seed-warmup:${userId}`,
        type: "warmup_before_live",
        programSlug: "adult",
      });
      await awardGamificationPoints({
        userId,
        eventId: `seed-intake:${userId}`,
        type: "intake_complete",
        programSlug: "adult",
      });
    }
    if (userId === "demo-user-stephanie") {
      await awardGamificationPoints({
        userId,
        eventId: `seed-intake-sched:${userId}`,
        type: "intake_scheduled",
        programSlug: "adult",
      });
    }
  }
}

async function buildRows(
  viewerId: string,
  scope: LeaderboardScope,
  programSlug: string | null,
): Promise<{ viewer: LeaderboardRow; rows: LeaderboardRow[] }> {
  await ensureDemoLeaderboardSeed();

  const participants = await discoverParticipantIds();
  const entries: Array<{ userId: string; displayName: string; points: number; bestMove: string | null }> =
    [];

  for (const [userId, nameHint] of participants) {
    if (userId.includes("coach")) continue;

    const userProgram = await primaryProgramSlug(userId);
    if (scope === "program" && programSlug && userProgram !== programSlug) continue;

    const ledger = await getUserGamification(userId);
    entries.push({
      userId,
      displayName: displayNameForUser(userId, nameHint),
      points: ledger.totalPoints,
      bestMove: bestMoveFromEvents(ledger.events),
    });
  }

  entries.sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName));

  const rows: LeaderboardRow[] = entries.map((e, idx) => ({
    rank: idx + 1,
    userId: e.userId,
    displayName: e.displayName,
    points: e.points,
    bestMove: e.bestMove,
    isSelf: e.userId === viewerId,
  }));

  const viewerEntry = rows.find((r) => r.isSelf);
  const viewer: LeaderboardRow = viewerEntry ?? {
    rank: rows.length + 1,
    userId: viewerId,
    displayName: displayNameForUser(viewerId),
    points: (await getUserGamification(viewerId)).totalPoints,
    bestMove: bestMoveFromEvents((await getUserGamification(viewerId)).events),
    isSelf: true,
  };

  return { viewer, rows };
}

export async function loadMemberLeaderboard(
  viewerId: string,
  scope: LeaderboardScope,
): Promise<LeaderboardPayload> {
  const programSlug = await primaryProgramSlug(viewerId);
  const { viewer, rows } = await buildRows(viewerId, scope, programSlug);

  let programName: string | null = null;
  if (programSlug) {
    try {
      const { getProgramBySlug } = await import("@/lib/program-data");
      const program = await getProgramBySlug(programSlug);
      programName = program?.name ?? programSlug;
    } catch {
      programName = programSlug;
    }
  }

  return {
    scope,
    programSlug,
    programName,
    viewer,
    rows,
    updatedAt: new Date().toISOString(),
  };
}