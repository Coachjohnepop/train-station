import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { getDailyUserActivity, isIsoDate, parseUsageRange, yesterdayIso } from "@/lib/daily-user-activity";
import { isDatabaseConfigured } from "@/lib/database-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const raw = url.searchParams.get("date");
  const date = isIsoDate(raw) ? raw : yesterdayIso();
  const range = parseUsageRange(url.searchParams.get("range"));

  const report = await getDailyUserActivity(date, range);

  return NextResponse.json({
    ...report,
    databaseConfigured: isDatabaseConfigured(),
  });
}
