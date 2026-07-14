import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  ensureLiveClassZoom,
  markLiveClassHostStarted,
  markLiveClassZoomNotified,
  notifyLiveClassZoomAttendees,
} from "@/lib/live-class-zoom";
import { zoomReady } from "@/lib/zoom";
import { ZOOM_FREE_MAX_DURATION_MIN } from "@/lib/zoom-oauth-flow";
import { zoomMeetingSdkConfigured } from "@/lib/zoom-meeting-sdk-signature";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  let sessionDate: string | undefined;
  /** Coach is opening the room as host (Join Live Now) — mark live for members. */
  let startHost = true;
  try {
    const body = await request.json();
    sessionDate = typeof body?.sessionDate === "string" ? body.sessionDate : undefined;
    if (body?.startHost === false) startHost = false;
  } catch {
    /* optional body */
  }

  try {
    const { record, created } = await ensureLiveClassZoom(sessionDate);
    let notified = 0;
    if (created && !record.demo) {
      const alert = await notifyLiveClassZoomAttendees(record.sessionDate, record.joinUrl);
      notified = alert.sent;
      await markLiveClassZoomNotified(record.sessionDate);
    }
    if (startHost && !record.demo) {
      await markLiveClassHostStarted(record.sessionDate);
    }
    return NextResponse.json({
      ok: true,
      created,
      notified,
      hostStarted: startHost && !record.demo,
      ready: await zoomReady(),
      sdkConfigured: zoomMeetingSdkConfigured(),
      maxDurationMin: ZOOM_FREE_MAX_DURATION_MIN,
      coachStartsFirst: true,
      demo: record.demo === true,
      zoom: {
        sessionDate: record.sessionDate,
        meetingId: record.meetingId,
        meetingNumber: record.meetingNumber,
        joinUrl: record.joinUrl,
        hostUrl: record.hostUrl,
        topic: record.topic,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create live class Zoom room.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const sessionDate = searchParams.get("date") ?? undefined;

  const { getLiveClassZoom } = await import("@/lib/live-class-zoom");
  const record = await getLiveClassZoom(sessionDate);

  return NextResponse.json({
    ok: true,
    ready: await zoomReady(),
    sdkConfigured: zoomMeetingSdkConfigured(),
    maxDurationMin: ZOOM_FREE_MAX_DURATION_MIN,
    zoom: record
      ? {
          sessionDate: record.sessionDate,
          meetingId: record.meetingId,
          meetingNumber: record.meetingNumber,
          joinUrl: record.joinUrl,
          hostUrl: record.hostUrl,
          topic: record.topic,
          demo: record.demo === true,
        }
      : null,
  });
}