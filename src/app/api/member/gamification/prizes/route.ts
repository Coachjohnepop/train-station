import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { listRecentPrizes, listPrizesForUser } from "@/lib/gamification-prizes";

export const dynamic = "force-dynamic";

/** Public-ish hall of fame + own prizes (auth required). */
export async function GET() {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;
  const [hall, mine] = await Promise.all([
    listRecentPrizes(12),
    listPrizesForUser(auth.session.id),
  ]);
  return NextResponse.json({ hall, mine });
}
