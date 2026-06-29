import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { buildCoachLiveFloor } from "@/lib/coach-live-floor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionDate = searchParams.get("date") ?? undefined;
  const floor = await buildCoachLiveFloor(sessionDate);

  return NextResponse.json(floor);
}