import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  canSubstituteStartLiveZoom,
  clearLiveClassHostStarted,
  ensureLiveClassZoom,
  getLiveClassZoom,
  isLiveClassHostActive,
  liveClassOpenUrlForCoach,
  markLiveClassHostStarted,
  markLiveClassZoomNotified,
  notifyLiveClassZoomAttendees,
} from "@/lib/live-class-zoom";
import { zoomHostStartUrl, zoomReady } from "@/lib/zoom";
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
    const substitute = canSubstituteStartLiveZoom(coachEmail);
    let notified = 0;
    if (created && !record.demo) {
      const alert = await notifyLiveClassZoomAttendees(record.sessionDate, record.joinUrl);
      notified = alert.sent;
      await markLiveClassZoomNotified(record.sessionDate);
    }
    // Jeremy, or John starting on Jeremy's saved Zoom.
    let hostStarted = false;
    if (startHost && open.isHost && !record.demo) {
      await markLiveClassHostStarted(record.sessionDate);
      hostStarted = true;
    }
    // Re-read so response (and any follow-up) includes hostStartedAt.
    const fresh = (await getLiveClassZoom(record.sessionDate)) || record;
    const zoom = zoomPayload(fresh, coachEmail);
    if (substitute && zoom && !fresh.demo) {
      const hostUrl = await zoomHostStartUrl({
        meetingNumber: fresh.meetingNumber || fresh.meetingId,
        password: fresh.password,
        coachEmail: fresh.hostCoachEmail,
      });
      if (hostUrl) {
        zoom.hostUrl = hostUrl;
        zoom.openUrl = hostUrl;
        zoom.isHost = true;
        zoom.openAs = "host";
      }
    }
    return NextResponse.json({
      ok: true,
      created,
      notified,
      hostStarted,
      ready: await zoomReady({ coachEmail }),
      sdkConfigured: zoomMeetingSdkConfigured(),
      maxDurationMin: ZOOM_FREE_MAX_DURATION_MIN,
      coachStartsFirst: true,
      demo: fresh.demo === true,
      zoom,
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