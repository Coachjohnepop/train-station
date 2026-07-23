import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { loadDivisionBoard } from "@/lib/gamification-division-board";
import type { GamificationDivision } from "@/lib/gamification-levers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const url = new URL(request.url);
  const raw = url.searchParams.get("division");
  const division =
    raw === "explorer" || raw === "member" || raw === "business" || raw === "pro"
      ? (raw as GamificationDivision)
      : null;

  const payload = await loadDivisionBoard(session.id, division);
  return NextResponse.json(payload);
}
