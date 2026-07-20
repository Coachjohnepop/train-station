import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  clearLiveClassHostStarted,
  ensureLiveClassZoom,
  getLiveClassZoom,
  isLiveClassHostActive,
  liveClassOpenUrlForCoach,
  markLiveClassHostStarted,
  markLiveClassZoomNotified,
  notifyLiveClassZoomAttendees,
} from "@/lib/live-class-zoom";
import { zoomReady } from "@/lib/zoom";
import { ZOOM_FREE_MAX_DURATION_MIN } from "@/lib/zoom-oauth-flow";
import { zoomMeetingSdkConfigured } from "@/lib/zoom-meeting-sdk-signature";

export const dynamic = "force-dynamic";

function zoomPayload(record: Awaited<ReturnType<typeof import("@/lib/live-class-zoom").getLiveClassZoom>>, coachEmail: string) {
  if (!record) return null;
  const open = liveClassOpenUrlForCoach(record, coachEmail);
  return {
    sessionDate: record.sessionDate,
    meetingId: record.meetingId,
    meetingNumber: record.meetingNumber,
    joinUrl: record.joinUrl,
    hostUrl: record.hostUrl,
    topic: record.topic,
    demo: record.demo === true,
    hostCoachEmail: record.hostCoachEmail || null,
    isHost: open.isHost,
    openAs: open.openAs,
    openUrl: open.openUrl,
  };
}

export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  let sessionDate: string | undefined;
  /** When true, mark host started if this coach is the live-class host. */
  let startHost = true;
  try {
    const body = await request.json();
    sessionDate = typeof body?.sessionDate === "string" ? body.sessionDate : undefined;
    if (body?.startHost === false) startHost = false;
  } catch {
    /* optional body */
  }

  try {
    const coachEmail = auth.session.email;
    const { record, created } = await ensureLiveClassZoom(sessionDate, { coachEmail });
    const open = liveClassOpenUrlForCoach(record, coachEmail);
    let notified = 0;
    if (created && !record.demo) {
      const alert = await notifyLiveClassZoomAttendees(record.sessionDate, record.joinUrl);
      notified = alert.sent;
      await markLiveClassZoomNotified(record.sessionDate);
    }
    // Only the real Zoom host marks the room "live" for members.
    if (startHost && open.isHost && !record.demo) {
      await markLiveClassHostStarted(record.sessionDate);
    }
    return NextResponse.json({
      ok: true,
      created,
      notified,
      hostStarted: startHost && open.isHost && !record.demo,
      ready: await zoomReady({ coachEmail }),
      sdkConfigured: zoomMeetingSdkConfigured(),
      maxDurationMin: ZOOM_FREE_MAX_DURATION_MIN,
      coachStartsFirst: true,
      demo: record.demo === true,
      zoom: zoomPayload(record, coachEmail),
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
  const coachEmail = auth.session.email;

  const record = await getLiveClassZoom(sessionDate);

  return NextResponse.json({
    ok: true,
    ready: await zoomReady({ coachEmail }),
    sdkConfigured: zoomMeetingSdkConfigured(),
    maxDurationMin: ZOOM_FREE_MAX_DURATION_MIN,
    hostStarted: isLiveClassHostActive(record),
    hostStartedAt: record?.hostStartedAt ?? null,
    zoom: zoomPayload(record, coachEmail),
  });
}

/** End member-facing "live" flag (coach finished class / false start). */
export async function DELETE(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  let sessionDate: string | undefined;
  try {
    const body = await request.json();
    sessionDate = typeof body?.sessionDate === "string" ? body.sessionDate : undefined;
  } catch {
    /* optional */
  }

  await clearLiveClassHostStarted(sessionDate);
  const coachEmail = auth.session.email;
  const record = await getLiveClassZoom(sessionDate);

  return NextResponse.json({
    ok: true,
    hostStarted: false,
    zoom: zoomPayload(record, coachEmail),
  });
}