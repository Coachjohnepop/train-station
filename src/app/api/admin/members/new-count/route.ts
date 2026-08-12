import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { listSelfRegisteredAccounts } from "@/lib/member-accounts-store";

export const dynamic = "force-dynamic";

/**
 * New self-registered members for coach nav badge.
 * `new` = accounts created after `since` (coach last opened Members).
 */
export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ total: 0, new: 0 });
  }

  const accounts = await listSelfRegisteredAccounts();
  const total = accounts.length;
  const since = request.nextUrl.searchParams.get("since");
  const sinceTime = since ? new Date(since).getTime() : NaN;

  const newCount = Number.isNaN(sinceTime)
    ? // First visit: only surface last 14 days so badge isn't huge forever
      accounts.filter(({ account }) => {
        const t = new Date(account.createdAt || 0).getTime();
        return Number.isFinite(t) && t > Date.now() - 14 * 24 * 60 * 60 * 1000;
      }).length
    : accounts.filter(({ account }) => {
        const t = new Date(account.createdAt || 0).getTime();
        return Number.isFinite(t) && t > sinceTime;
      }).length;

  return NextResponse.json({ total, new: newCount });
}
