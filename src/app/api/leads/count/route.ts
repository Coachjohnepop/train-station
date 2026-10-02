import { NextRequest, NextResponse } from "next/server";
import { listLeads } from "@/lib/waitlist";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { normalizeLeadLane } from "@/lib/waitlist-lane";

export const dynamic = "force-dynamic";

/**
 * Lead counts for the admin nav badge.
 * - `total`: all leads.
 * - `new`: leads created after the `since` timestamp (what the coach hasn't
 *   seen yet). If `since` is absent, every lead counts as new.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ total: 0, new: 0 });
  }

  const leads = await listLeads();
  const active = leads.filter((lead) => normalizeLeadLane(lead.lane) !== "archive");
  const total = active.length;

  const since = request.nextUrl.searchParams.get("since");
  const sinceTime = since ? new Date(since).getTime() : NaN;
  const newCount = Number.isNaN(sinceTime)
    ? total
    : active.filter((l) => new Date(l.createdAt).getTime() > sinceTime).length;

  return NextResponse.json({ total, new: newCount });
}
