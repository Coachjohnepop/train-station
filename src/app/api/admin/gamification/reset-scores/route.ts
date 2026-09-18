import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { isDatabaseConfigured } from "@/lib/database-config";
import {
  auditContextFromRequest,
  writeGamificationAudit,
} from "@/lib/gamification-audit";
import { resetAllGamificationScores } from "@/lib/member-gamification-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { detail: "Database required to reset scores." },
      { status: 503 },
    );
  }

  const result = await resetAllGamificationScores();

  await writeGamificationAudit({
    action: "points.reset",
    actor: auditContextFromRequest(request, auth.session.id, auth.session.role),
    detail: result,
  });

  return NextResponse.json({ ok: true, ...result });
}
