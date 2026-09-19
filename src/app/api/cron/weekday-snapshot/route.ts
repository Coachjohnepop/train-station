import { NextResponse } from "next/server";
import { snapshotLastCompleteWeek } from "@/lib/analytics-weekday-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

/** Mondays: freeze last complete Pacific Sun–Sat for Station pulse pie. */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const snap = await snapshotLastCompleteWeek();
  return NextResponse.json({
    ok: true,
    weekStart: snap.weekStart,
    label: snap.label,
    rows: snap.rows,
  });
}
