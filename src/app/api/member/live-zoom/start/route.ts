import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import {
  canSubstituteStartLiveZoom,
  ensureLiveClassZoom,
  getLiveClassZoom,
  markLiveClassHostStarted,
  markLiveClassZoomNotified,
  notifyLiveClassZoomAttendees,
} from "@/lib/live-class-zoom";
import { zoomHostStartUrl } from "@/lib/zoom";

export const dynamic = "force-dynamic";

/** John starts today's class on Jeremy's saved Zoom. Members then see Join. */
export async function POST(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;
  if (!canSubstituteStartLiveZoom(auth.session.email)) {
    return NextResponse.json({ error: "Only John can start Zoom for Jeremy." }, { status: 403 });
  }

  let sessionDate: string | undefined;
  try {
    const body = await request.json();
    sessionDate = typeof body?.sessionDate === "string" ? body.sessionDate : undefined;
  } catch {
    /* optional */
  }

  try {
    const { record, created } = await ensureLiveClassZoom(sessionDate, {
      coachEmail: auth.session.email,
    });
    if (record.demo) {
      return NextResponse.json({ error: "Zoom is not connected for the class host." }, { status: 503 });
    }
    if (created) {
      const alert = await notifyLiveClassZoomAttendees(record.sessionDate, record.joinUrl);
      await markLiveClassZoomNotified(record.sessionDate);
      void alert;
    }
    await markLiveClassHostStarted(record.sessionDate);
    const fresh = (await getLiveClassZoom(record.sessionDate)) || record;
    const openUrl = await zoomHostStartUrl({
      meetingNumber: fresh.meetingNumber || fresh.meetingId,
      password: fresh.password,
      coachEmail: fresh.hostCoachEmail,
    });
    if (!openUrl) {
      return NextResponse.json({ error: "Could not open Jeremy's Zoom as host." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, openUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start Zoom.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
