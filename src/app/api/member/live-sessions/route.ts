import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { getMemberLiveSessions } from "@/lib/booking";
import { zoomReady } from "@/lib/zoom";
import { ZOOM_FREE_MAX_DURATION_MIN } from "@/lib/zoom-oauth-flow";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const sessions = await getMemberLiveSessions({
    memberEmail: auth.session.email,
    userId: auth.session.id,
  });

  return NextResponse.json({
    sessions,
    zoomReady: await zoomReady(),
    maxDurationMin: ZOOM_FREE_MAX_DURATION_MIN,
    coachStartsFirst: true,
  });
}