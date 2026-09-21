import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/database-config";
import {
  drawMonthlyUpgradePromo,
  pacificMonthKey,
  previousPacificMonthKey,
} from "@/lib/business-upgrade-monthly-promo";
import { localTodayIso } from "@/lib/program-calendar";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim() || process.env.STAFF_GRANT_CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

function isFirstOfMonth(from = new Date()): boolean {
  return localTodayIso(from).slice(8) === "01";
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, detail: "no database" });
  }

  const now = new Date();
  if (!isFirstOfMonth(now)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Draw runs on the 1st (Pacific).",
      today: localTodayIso(now),
      currentMonth: pacificMonthKey(now),
    });
  }

  const monthKey = previousPacificMonthKey(now);
  const result = await drawMonthlyUpgradePromo({
    monthKey,
    actor: "cron",
  });
  if ("error" in result) {
    return NextResponse.json(result, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    monthKey,
    alreadyDrawn: result.alreadyDrawn,
    winnerEmail: result.promo.winnerEmail,
    winnerName: result.winnerName,
    eligibleCount: result.promo.eligibleCount,
  });
}
