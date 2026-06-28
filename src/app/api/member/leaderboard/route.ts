import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { loadMemberLeaderboard } from "@/lib/member-leaderboard";
import type { LeaderboardScope } from "@/lib/gamification-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const scopeRaw = url.searchParams.get("scope");
  const scope: LeaderboardScope = scopeRaw === "site" ? "site" : "program";

  const payload = await loadMemberLeaderboard(session.id, scope);
  return NextResponse.json(payload);
}