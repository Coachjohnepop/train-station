import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import {
  getLiveClassZoom,
  memberHasLiveAccessOnDate,
} from "@/lib/live-class-zoom";
import {
  createZoomMeetingSdkSignature,
  zoomMeetingSdkConfigured,
} from "@/lib/zoom-meeting-sdk-signature";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const sessionDate = searchParams.get("date") ?? undefined;

  const allowed = await memberHasLiveAccessOnDate({
    memberEmail: auth.session.email,
    userId: auth.session.id,
    sessionDate,
  });
  if (!allowed) {
    return NextResponse.json({ error: "No live session access for this date." }, { status: 403 });
  }

  const record = await getLiveClassZoom(sessionDate);
  if (!record) {
    return NextResponse.json({ error: "Coach has not opened the live Zoom room yet." }, { status: 404 });
  }

  if (!zoomMeetingSdkConfigured() || record.demo) {
    return NextResponse.json({
      demo: record.demo === true,
      joinUrl: record.joinUrl,
      meetingNumber: record.meetingNumber,
      sessionDate: record.sessionDate,
    });
  }

  try {
    const { signature, sdkKey } = await createZoomMeetingSdkSignature({
      meetingNumber: record.meetingNumber,
      role: 0,
    });

    const displayName =
      auth.session.name?.trim() || auth.session.email.split("@")[0] || "Member";

    return NextResponse.json({
      signature,
      sdkKey,
      meetingNumber: record.meetingNumber,
      password: record.password,
      userName: displayName,
      userEmail: auth.session.email,
      joinUrl: record.joinUrl,
      sessionDate: record.sessionDate,
      role: 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not prepare Zoom credentials.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}