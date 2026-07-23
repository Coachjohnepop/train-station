import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";
import { JEREMY_MEMBER_IDS } from "@/lib/demo-coach";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { listMemberProfiles } from "@/lib/member-profiles-store";
import { getAllSignInAccounts } from "@/lib/member-accounts-store";
import {
  GAMIFICATION_EVENT_LABELS,
  type LeaderboardRow,
} from "@/lib/gamification-types";
import {
  getUserGamification,
  listAllGamification,
} from "@/lib/member-gamification-store";
import { getGamificationLevers } from "@/lib/gamification-config-store";
import {
  currentSeasonKey,
  recomputeDivisionRanks,
  recomputeUserSeasonScore,
} from "@/lib/gamification-season";
import {
  divisionForPlan,
  divisionLabel,
  type GamificationDivision,
} from "@/lib/gamification-levers";
import { getEffectiveMembershipPlan } from "@/lib/gamification-promos";
import { getMemberProfile } from "@/lib/member-profiles-store";

export type DivisionBoardPayload = {
  division: GamificationDivision;
  divisionLabel: string;
  seasonKey: string;
  seasonDays: number;
  viewer: LeaderboardRow & {
    percentile: number;
    topPercent: boolean;
    eligible: boolean;
    seasonPoints: number;
  };
  rows: Array<
    LeaderboardRow & { percentile: number; topPercent: boolean; eligible: boolean }
  >;
  /** Coach top 25% can peek upstairs */
  peek: {
    enabled: boolean;
    divisions: Array<{
      division: GamificationDivision;
      label: string;
      rows: Array<{ rank: number; displayName: string; points: number }>;
    }>;
  } | null;
  openPromo: {
    id: string;
    toPlan: string;
    claimBy: string | null;
  } | null;
  activeTrial: {
    plan: string;
    trialEndsAt: string;
  } | null;
  updatedAt: string;
};

function displayNameForUser(userId: string, fallbackName?: string | null): string {
  const directory = resolveDemoUser(userId);
  if (directory?.name) return directory.name;
  if (fallbackName?.trim()) return fallbackName.trim();
  return userId.startsWith("member-") ? "Member" : "Racer";
}

async function nameMap(): Promise<Map<string, string | null>> {
  const names = new Map<string, string | null>();
  for (const id of JEREMY_MEMBER_IDS) {
    names.set(id, resolveDemoUser(id)?.name ?? null);
  }
  try {
    const profiles = await listMemberProfiles();
    for (const p of profiles) {
      names.set(p.userId, resolveDemoUser(p.userId)?.name ?? p.email.split("@")[0]);
    }
  } catch {
    /* ignore */
  }
  try {
    const accounts = await getAllSignInAccounts();
    for (const [, account] of Object.entries(accounts)) {
      if (account.role !== "MEMBER") continue;
      if (!names.has(account.userId)) {
        names.set(account.userId, account.name ?? null);
      }
    }
  } catch {
    /* ignore */
  }
  return names;
}

async function bestMove(userId: string): Promise<string | null> {
  const ledger = await getUserGamification(userId);
  if (!ledger.events.length) return null;
  const sorted = [...ledger.events].sort(
    (a, b) => b.points - a.points || b.at.localeCompare(a.at),
  );
  const top = sorted[0];
  return GAMIFICATION_EVENT_LABELS[top.type] || top.label;
}

/** Division board using season scores when DB is live; falls back to lifetime points. */
export async function loadDivisionBoard(
  viewerId: string,
  divisionFilter?: GamificationDivision | null,
): Promise<DivisionBoardPayload> {
  const levers = await getGamificationLevers();
  const profile = await getMemberProfile(viewerId);
  const effective = await getEffectiveMembershipPlan(viewerId, profile?.plan);
  const viewerDivision = divisionFilter ?? divisionForPlan(effective);
  const seasonKey = currentSeasonKey(levers.seasonDays);
  const names = await nameMap();

  // Ensure viewer has a season row
  if (isDatabaseConfigured()) {
    try {
      await recomputeUserSeasonScore(viewerId, divisionForPlan(effective), levers);
    } catch {
      /* ignore */
    }
  }

  let ranked = isDatabaseConfigured()
    ? await recomputeDivisionRanks(viewerDivision, levers)
    : [];

  // Fallback: lifetime points by plan when no season rows
  if (!ranked.length || !isDatabaseConfigured()) {
    const ledgers = await listAllGamification();
    const profiles = await listMemberProfiles().catch(() => []);
    const planByUser = new Map(profiles.map((p) => [p.userId, p.plan]));
    const entries = ledgers
      .filter((l) => divisionForPlan(planByUser.get(l.userId) || "explorer") === viewerDivision)
      .map((l) => ({
        userId: l.userId,
        points: l.totalPoints,
        activeDays: 1,
      }))
      .sort((a, b) => b.points - a.points);

    ranked = entries.map((e, i) => {
      const n = entries.length;
      const rank = i + 1;
      const cut = Math.max(1, Math.ceil((levers.topPercentile / 100) * Math.max(n, 1)));
      return {
        userId: e.userId,
        division: viewerDivision,
        points: e.points,
        activeDays: e.activeDays,
        rank,
        percentile: n ? Math.round((100 * (n - rank + 1)) / n) : 0,
        eligible: true,
        topPercent: rank <= cut,
      };
    });
  }

  const rows: DivisionBoardPayload["rows"] = await Promise.all(
    ranked.map(async (r) => ({
      rank: r.rank,
      userId: r.userId,
      displayName: displayNameForUser(r.userId, names.get(r.userId)),
      points: r.points,
      bestMove: await bestMove(r.userId),
      isSelf: r.userId === viewerId,
      percentile: r.percentile,
      topPercent: r.topPercent,
      eligible: r.eligible,
    })),
  );

  const self = ranked.find((r) => r.userId === viewerId);
  const viewerRow = rows.find((r) => r.isSelf);
  const viewer: DivisionBoardPayload["viewer"] = viewerRow
    ? {
        ...viewerRow,
        seasonPoints: self?.points ?? viewerRow.points,
      }
    : {
        rank: rows.length + 1,
        userId: viewerId,
        displayName: displayNameForUser(viewerId),
        points: 0,
        bestMove: null,
        isSelf: true,
        percentile: 0,
        topPercent: false,
        eligible: false,
        seasonPoints: 0,
      };

  // Peek upstairs for Coach top 25%
  let peek: DivisionBoardPayload["peek"] = null;
  if (
    levers.crossDivisionPeek &&
    viewerDivision === "member" &&
    self?.topPercent
  ) {
    const upstairs: GamificationDivision[] = ["business", "pro"];
    const divisions = [];
    for (const d of upstairs) {
      const up = isDatabaseConfigured()
        ? await recomputeDivisionRanks(d, levers)
        : [];
      divisions.push({
        division: d,
        label: divisionLabel(d),
        rows: up.slice(0, 10).map((r) => ({
          rank: r.rank,
          displayName: levers.anonymizeRivals
            ? `Racer ${r.rank}`
            : displayNameForUser(r.userId, names.get(r.userId)),
          points: r.points,
        })),
      });
    }
    peek = { enabled: true, divisions };
  }

  let openPromo: DivisionBoardPayload["openPromo"] = null;
  let activeTrial: DivisionBoardPayload["activeTrial"] = null;
  if (isDatabaseConfigured()) {
    try {
      const promo = await prisma.gamificationPromo.findFirst({
        where: { userId: viewerId, status: "offered" },
        orderBy: { offeredAt: "desc" },
      });
      if (promo) {
        openPromo = {
          id: promo.id,
          toPlan: promo.toPlan,
          claimBy: promo.claimBy?.toISOString() ?? null,
        };
      }
      const trial = await prisma.gamificationPromo.findFirst({
        where: {
          userId: viewerId,
          status: "claimed",
          trialEndsAt: { gt: new Date() },
        },
      });
      if (trial?.trialEndsAt) {
        activeTrial = {
          plan: trial.toPlan,
          trialEndsAt: trial.trialEndsAt.toISOString(),
        };
      }
    } catch {
      /* ignore */
    }
  }

  return {
    division: viewerDivision,
    divisionLabel: divisionLabel(viewerDivision),
    seasonKey,
    seasonDays: levers.seasonDays,
    viewer,
    rows,
    peek,
    openPromo,
    activeTrial,
    updatedAt: new Date().toISOString(),
  };
}
