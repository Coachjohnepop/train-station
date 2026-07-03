import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { getAnalyticsOverview } from "@/lib/analytics-store";
import { isDatabaseConfigured } from "@/lib/database-config";

export async function GET(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") || "7")));

  const overview = await getAnalyticsOverview(days);

  return NextResponse.json({
    ...overview,
    databaseConfigured: isDatabaseConfigured(),
    periodDays: days,
  });
}