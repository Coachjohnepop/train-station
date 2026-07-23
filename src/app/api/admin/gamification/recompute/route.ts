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
    detail: { expired, offered },
  });

  return NextResponse.json({ ok: true, expired, offered });
}
