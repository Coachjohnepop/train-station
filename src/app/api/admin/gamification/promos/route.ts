import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";
import {
  listAllOpenPromos,
  revokePromo,
} from "@/lib/gamification-promos";
import { getGamificationLevers } from "@/lib/gamification-config-store";
import {
  auditContextFromRequest,
  writeGamificationAudit,
} from "@/lib/gamification-audit";

export const dynamic = "force-dynamic";

const grantSchema = z.object({
  userId: z.string().min(1),
  fromPlan: z.string().min(1),
  toPlan: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const promos = await listAllOpenPromos();
  return NextResponse.json({ promos, database: isDatabaseConfigured() });
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ detail: "Database required." }, { status: 503 });
  }
  const body = grantSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ detail: body.error.flatten() }, { status: 400 });
  }
  const levers = await getGamificationLevers();
  const now = new Date();
  const claimBy = new Date(now.getTime() + levers.claimWindowHours * 3600_000);
  const promo = await prisma.gamificationPromo.create({
    data: {
      userId: body.data.userId,
      kind: "free_week_upgrade",
      fromPlan: body.data.fromPlan,
      toPlan: body.data.toPlan,
      status: "offered",
      offeredAt: now,
      claimBy,
      notes: body.data.notes || `Manual grant by ${auth.session.id}`,
    },
  });
  await writeGamificationAudit({
    action: "promo.offer",
    actor: auditContextFromRequest(request, auth.session.id, auth.session.role),
    targetId: promo.id,
    detail: {
      userId: body.data.userId,
      fromPlan: body.data.fromPlan,
      toPlan: body.data.toPlan,
      manual: true,
    },
  });
  return NextResponse.json({ promo }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ detail: "id required" }, { status: 400 });
  }
  const result = await revokePromo(id);
  if (!result.ok) {
    return NextResponse.json({ detail: result.error }, { status: 400 });
  }
  await writeGamificationAudit({
    action: "promo.revoke",
    actor: auditContextFromRequest(request, auth.session.id, auth.session.role),
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}
