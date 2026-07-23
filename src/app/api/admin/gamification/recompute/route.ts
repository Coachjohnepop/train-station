import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { isDatabaseConfigured } from "@/lib/database-config";
import { recomputeAllDivisions } from "@/lib/gamification-season";
import { offerTopPercentPromos, expireStalePromos } from "@/lib/gamification-promos";
import type { GamificationDivision } from "@/lib/gamification-levers";
import {
  auditContextFromRequest,
  writeGamificationAudit,
} from "@/lib/gamification-audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { detail: "Database required for season recompute." },
      { status: 503 },
    );
  }

  const { importBlobGamificationToDb } = await import("@/lib/gamification-import");
  const imported = await importBlobGamificationToDb({ actorId: auth.session.id });

  // Rebuild season scores from all events after import
  const { recomputeUserSeasonScore } = await import("@/lib/gamification-season");
  const { divisionForPlan } = await import("@/lib/gamification-levers");
  const { listMemberProfiles } = await import("@/lib/member-profiles-store");
  const { getGamificationLevers } = await import("@/lib/gamification-config-store");
  const levers = await getGamificationLevers();
  try {
    const users = await prisma.gamificationEvent.findMany({
      distinct: ["userId"],
      select: { userId: true },
    });
    const profiles = await listMemberProfiles().catch(() => []);
    const planBy = new Map(profiles.map((p) => [p.userId, p.plan]));
    for (const u of users) {
      await recomputeUserSeasonScore(
        u.userId,
        divisionForPlan(planBy.get(u.userId) || "explorer"),
        levers,
      );
    }
  } catch (e) {
    console.error("season score rebuild", e);
  }

  const expired = await expireStalePromos();
  await recomputeAllDivisions();

  const divisions: GamificationDivision[] = ["explorer", "member", "business", "pro"];
  let offered = 0;
  for (const d of divisions) {
    if (d === "pro") continue;
    const r = await offerTopPercentPromos(d);
    offered += r.offered;
  }

  await writeGamificationAudit({
    action: "season.recompute",
    actor: auditContextFromRequest(request, auth.session.id, auth.session.role),
    detail: { expired, offered, imported },
  });

  return NextResponse.json({ ok: true, expired, offered, imported });
}
