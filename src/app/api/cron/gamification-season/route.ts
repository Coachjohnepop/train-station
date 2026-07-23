import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/database-config";
import { recomputeAllDivisions } from "@/lib/gamification-season";
import { offerTopPercentPromos, expireStalePromos } from "@/lib/gamification-promos";
import type { GamificationDivision } from "@/lib/gamification-levers";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim() || process.env.GAMIFICATION_CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, detail: "no database" });
  }
  const { importBlobGamificationToDb } = await import("@/lib/gamification-import");
  const imported = await importBlobGamificationToDb({ actorId: "cron" });
  const expired = await expireStalePromos();
  await recomputeAllDivisions();
  let offered = 0;
  for (const d of ["explorer", "member", "business"] as GamificationDivision[]) {
    offered += (await offerTopPercentPromos(d)).offered;
  }
  return NextResponse.json({ ok: true, expired, offered, imported });
}

export async function POST(request: Request) {
  return GET(request);
}
