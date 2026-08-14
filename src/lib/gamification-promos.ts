import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";
import { getGamificationLevers } from "@/lib/gamification-config-store";
import {
  currentSeasonKey,
  recomputeDivisionRanks,
} from "@/lib/gamification-season";
import {
  divisionForPlan,
  nextPlanUp,
  type GamificationDivision,
} from "@/lib/gamification-levers";
import { getMemberProfile } from "@/lib/member-profiles-store";
import type { MembershipPlan } from "@/lib/signup-plans";
import {
  isMembershipPlan,
  isPaidMembershipPlan,
  resolveEffectiveMembershipPlan,
} from "@/lib/signup-plans";

export type PromoDto = {
  id: string;
  userId: string;
  kind: string;
  fromPlan: string;
  toPlan: string;
  status: string;
  offeredAt: string;
  claimBy: string | null;
  claimedAt: string | null;
  trialEndsAt: string | null;
  convertedAt: string | null;
};

function toDto(row: {
  id: string;
  userId: string;
  kind: string;
  fromPlan: string;
  toPlan: string;
  status: string;
  offeredAt: Date;
  claimBy: Date | null;
  claimedAt: Date | null;
  trialEndsAt: Date | null;
  convertedAt: Date | null;
}): PromoDto {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    fromPlan: row.fromPlan,
    toPlan: row.toPlan,
    status: row.status,
    offeredAt: row.offeredAt.toISOString(),
    claimBy: row.claimBy?.toISOString() ?? null,
    claimedAt: row.claimedAt?.toISOString() ?? null,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    convertedAt: row.convertedAt?.toISOString() ?? null,
  };
}

/** Active free-week override if claimed and not expired. */
export async function getActiveAccessOverride(
  userId: string,
): Promise<{ plan: MembershipPlan; trialEndsAt: Date; promoId: string } | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const now = new Date();
    const row = await prisma.gamificationPromo.findFirst({
      where: {
        userId,
        status: "claimed",
        trialEndsAt: { gt: now },
      },
      orderBy: { trialEndsAt: "desc" },
    });
    if (!row || !isMembershipPlan(row.toPlan as MembershipPlan)) return null;
    return {
      plan: row.toPlan as MembershipPlan,
      trialEndsAt: row.trialEndsAt!,
      promoId: row.id,
    };
  } catch {
    return null;
  }
}

/**
 * Effective plan for content + board: promo override wins over paid plan stamp.
 */
export async function getEffectiveMembershipPlan(
  userId: string,
  profilePlan?: string | null,
): Promise<MembershipPlan> {
  const override = await getActiveAccessOverride(userId);
  if (override) return override.plan;
  if (isPaidMembershipPlan(profilePlan)) return profilePlan;

  const profile = await getMemberProfile(userId);
  const stamped = profilePlan ?? profile?.plan ?? "explorer";
  if (isPaidMembershipPlan(stamped)) return stamped;

  let signupPlan: string | null = null;
  if (profile?.paymentStatus === "paid" || !isMembershipPlan(stamped as MembershipPlan)) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { signupPlan: true },
      });
      signupPlan = user?.signupPlan ?? null;
    } catch {
      /* non-fatal */
    }
  }

  return resolveEffectiveMembershipPlan({
    profilePlan: stamped,
    signupPlan,
    paymentStatus: profile?.paymentStatus ?? null,
  });
}

export async function listPromosForUser(userId: string): Promise<PromoDto[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await prisma.gamificationPromo.findMany({
    where: { userId },
    orderBy: { offeredAt: "desc" },
    take: 20,
  });
  return rows.map(toDto);
}

export async function listAllOpenPromos(): Promise<PromoDto[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await prisma.gamificationPromo.findMany({
    where: { status: { in: ["offered", "claimed"] } },
    orderBy: { offeredAt: "desc" },
    take: 100,
  });
  return rows.map(toDto);
}

/** Offer free-week to top percentile members in a division who don't have a recent edge. */
export async function offerTopPercentPromos(
  division: GamificationDivision,
): Promise<{ offered: number }> {
  if (!isDatabaseConfigured()) return { offered: 0 };
  const levers = await getGamificationLevers();
  if (!levers.featureEnabled) return { offered: 0 };

  const ranked = await recomputeDivisionRanks(division, levers);
  const toPlan = nextPlanUp(division);
  if (!toPlan) return { offered: 0 };

  const top = ranked.filter((r) => r.topPercent && r.eligible);
  let offered = 0;
  const now = new Date();
  const claimBy = new Date(now.getTime() + levers.claimWindowHours * 3600_000);
  const cooldownMs = levers.cooldownDaysPerEdge * 86_400_000;

  for (const row of top) {
    // Already has open offer or active trial
    const open = await prisma.gamificationPromo.findFirst({
      where: {
        userId: row.userId,
        fromPlan: division,
        toPlan,
        status: { in: ["offered", "claimed"] },
      },
    });
    if (open) continue;

    // Cooldown: any past promo on this edge within window
    const recent = await prisma.gamificationPromo.findFirst({
      where: {
        userId: row.userId,
        fromPlan: division,
        toPlan,
        offeredAt: { gte: new Date(now.getTime() - cooldownMs) },
      },
    });
    if (recent) continue;

    // Confirm profile plan matches division (effective paid stamp)
    const profile = await getMemberProfile(row.userId);
    if (divisionForPlan(profile?.plan) !== division) continue;

    await prisma.gamificationPromo.create({
      data: {
        userId: row.userId,
        kind: "free_week_upgrade",
        fromPlan: division,
        toPlan,
        status: "offered",
        offeredAt: now,
        claimBy,
        notes: `Top ${levers.topPercentile}% ${division} season ${currentSeasonKey(levers.seasonDays)}`,
      },
    });
    offered += 1;
  }

  return { offered };
}

export async function claimPromo(
  userId: string,
  promoId: string,
): Promise<{ ok: true; promo: PromoDto } | { ok: false; error: string }> {
  if (!isDatabaseConfigured()) {
    return { ok: false, error: "Promos require database." };
  }
  const levers = await getGamificationLevers();
  const row = await prisma.gamificationPromo.findUnique({ where: { id: promoId } });
  if (!row || row.userId !== userId) {
    return { ok: false, error: "Promo not found." };
  }
  if (row.status !== "offered") {
    return { ok: false, error: `Promo is ${row.status}.` };
  }
  if (row.claimBy && row.claimBy < new Date()) {
    await prisma.gamificationPromo.update({
      where: { id: promoId },
      data: { status: "expired" },
    });
    return { ok: false, error: "Claim window expired." };
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + levers.freeWeekDays * 86_400_000);
  const updated = await prisma.gamificationPromo.update({
    where: { id: promoId },
    data: {
      status: "claimed",
      claimedAt: now,
      trialEndsAt,
    },
  });
  return { ok: true, promo: toDto(updated) };
}

export async function revokePromo(
  promoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database required." };
  const row = await prisma.gamificationPromo.findUnique({ where: { id: promoId } });
  if (!row) return { ok: false, error: "Not found." };
  await prisma.gamificationPromo.update({
    where: { id: promoId },
    data: { status: "revoked", revokedAt: new Date() },
  });
  return { ok: true };
}

export async function expireStalePromos(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const now = new Date();
  const a = await prisma.gamificationPromo.updateMany({
    where: { status: "offered", claimBy: { lt: now } },
    data: { status: "expired" },
  });
  const b = await prisma.gamificationPromo.updateMany({
    where: { status: "claimed", trialEndsAt: { lt: now } },
    data: { status: "expired" },
  });
  return a.count + b.count;
}
