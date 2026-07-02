import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import { ensureLiveClassZoom } from "@/lib/live-class-zoom";
import { zoomReady } from "@/lib/zoom";
import { ZOOM_FREE_MAX_DURATION_MIN } from "@/lib/zoom-oauth-flow";
import { zoomMeetingSdkConfigured } from "@/lib/zoom-meeting-sdk-signature";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  let sessionDate: string | undefined;
  try {
    const body = await request.json();
    sessionDate = typeof body?.sessionDate === "string" ? body.sessionDate : undefined;
  } catch {
    /* optional body */
  }

  try {
    const { record, created } = await ensureLiveClassZoom(sessionDate);
    return NextResponse.json({
      ok: true,
      created,
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