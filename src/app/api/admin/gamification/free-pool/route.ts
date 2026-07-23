import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { isDatabaseConfigured } from "@/lib/database-config";
import {
  listProgramFreePoolDays,
  setProgramDayFreePool,
} from "@/lib/gamification-free-pool";
import {
  auditContextFromRequest,
  writeGamificationAudit,
} from "@/lib/gamification-audit";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  dayId: z.string().min(1),
  freePool: z.boolean(),
  contentTierMin: z.string().max(40).nullable().optional(),
});

export async function GET(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const slug = url.searchParams.get("program") || "adult";
  const data = await listProgramFreePoolDays(slug);
  return NextResponse.json({
    program: slug,
    database: isDatabaseConfigured(),
    curatedCount: data.curatedCount,
    days: data.days,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ detail: "Database required." }, { status: 503 });
  }
  const body = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ detail: body.error.flatten() }, { status: 400 });
  }
  const day = await setProgramDayFreePool(
    body.data.dayId,
    body.data.freePool,
    body.data.contentTierMin,
  );
  if (!day) {
    return NextResponse.json({ detail: "Day not found." }, { status: 404 });
  }
  await writeGamificationAudit({
    action: "free_pool.patch",
    actor: auditContextFromRequest(request, auth.session.id, auth.session.role),
    targetId: body.data.dayId,
    detail: {
      freePool: body.data.freePool,
      contentTierMin: body.data.contentTierMin ?? null,
    },
  });
  return NextResponse.json({ day });
}
