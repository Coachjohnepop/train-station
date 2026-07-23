import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { listGamificationAudit } from "@/lib/gamification-audit";
import { isDatabaseConfigured } from "@/lib/database-config";

export const dynamic = "force-dynamic";

/** Staff-readable append-only audit trail (M&A / compliance). */
export async function GET(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || "50");
  const action = url.searchParams.get("action") || undefined;
  const actorId = url.searchParams.get("actorId") || undefined;

  const entries = await listGamificationAudit({
    limit: Number.isFinite(limit) ? limit : 50,
    action,
    actorId,
  });

  return NextResponse.json({
    database: isDatabaseConfigured(),
    entries,
  });
}
