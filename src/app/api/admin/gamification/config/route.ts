import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import {
  getGamificationLevers,
  saveGamificationLevers,
} from "@/lib/gamification-config-store";
import { DEFAULT_GAMIFICATION_LEVERS } from "@/lib/gamification-levers";
import { isDatabaseConfigured } from "@/lib/database-config";
import {
  auditContextFromRequest,
  writeGamificationAudit,
} from "@/lib/gamification-audit";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  freeContentPercent: z.number().int().min(0).max(100).optional(),
  coachContentPercent: z.number().int().min(0).max(100).optional(),
  topPercentile: z.number().int().min(1).max(100).optional(),
  freeWeekDays: z.number().int().min(1).max(30).optional(),
  claimWindowHours: z.number().int().min(1).max(720).optional(),
  seasonDays: z.number().int().min(7).max(90).optional(),
  crossDivisionPeek: z.boolean().optional(),
  prizeBandEnabled: z.boolean().optional(),
  minActiveDaysForPercentile: z.number().int().min(0).max(28).optional(),
  minSeasonPointsForPercentile: z.number().int().min(0).max(100_000).optional(),
  minDivisionSizeForTopCut: z.number().int().min(1).max(100).optional(),
  dailyPointCap: z.number().int().min(0).max(10_000).optional(),
  cooldownDaysPerEdge: z.number().int().min(0).max(365).optional(),
  anonymizeRivals: z.boolean().optional(),
  featureEnabled: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const levers = await getGamificationLevers();
  return NextResponse.json({
    levers,
    defaults: DEFAULT_GAMIFICATION_LEVERS,
    database: isDatabaseConfigured(),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const body = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ detail: body.error.flatten() }, { status: 400 });
  }
  const before = await getGamificationLevers();
  const levers = await saveGamificationLevers(body.data, auth.session.id);
  await writeGamificationAudit({
    action: "config.patch",
    actor: auditContextFromRequest(request, auth.session.id, auth.session.role),
    targetId: "default",
    detail: { before, after: levers, patch: body.data },
  });
  return NextResponse.json({ levers });
}
