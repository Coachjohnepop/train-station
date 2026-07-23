import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { claimPromo } from "@/lib/gamification-promos";
import {
  auditContextFromRequest,
  writeGamificationAudit,
} from "@/lib/gamification-audit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await params;
  const result = await claimPromo(session.id, id);
  if (!result.ok) {
    return NextResponse.json({ detail: result.error }, { status: 400 });
  }
  await writeGamificationAudit({
    action: "promo.claim",
    actor: auditContextFromRequest(request, session.id, session.role),
    targetId: id,
    detail: {
      toPlan: result.promo.toPlan,
      trialEndsAt: result.promo.trialEndsAt,
    },
  });
  return NextResponse.json({ promo: result.promo });
}
