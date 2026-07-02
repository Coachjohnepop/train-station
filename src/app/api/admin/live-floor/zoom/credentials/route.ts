import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import { ensureLiveClassZoom, getLiveClassZoom } from "@/lib/live-class-zoom";
import { fetchZoomZakToken } from "@/lib/zoom";
import {
  createZoomMeetingSdkSignature,
  zoomMeetingSdkConfigured,
} from "@/lib/zoom-meeting-sdk-signature";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  if (!zoomMeetingSdkConfigured()) {
    return NextResponse.json(
      { error: "Set ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET for Meeting SDK embed." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const sessionDate = searchParams.get("date") ?? undefined;
  const ensure = searchParams.get("ensure") === "1";

  try {
    let record = await getLiveClassZoom(sessionDate);
    if (!record && ensure) {
      const ensured = await ensureLiveClassZoom(sessionDate);
      record = ensured.record;
    }
    if (!record) {
      return NextResponse.json({ error: "No live class Zoom room for this date yet." }, { status: 404 });
    }
    if (record.demo) {
      return NextResponse.json({
        demo: true,
        joinUrl: record.joinUrl,
        hostUrl: record.hostUrl,
        meetingNumber: record.meetingNumber,
      });
    }

    const { signature, sdkKey } = await createZoomMeetingSdkSignature({
      meetingNumber: record.meetingNumber,
      role: 1,
    });

    let zak: string | null = null;
    try {
      zak = await fetchZoomZakToken();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not fetch ZAK token.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const displayName =
      auth.session.name?.trim() || auth.session.email.split("@")[0] || "Coach";

    return NextResponse.json({
      signature,
      sdkKey,
      meetingNumber: record.meetingNumber,
      password: record.password,
      userName: displayName,
      zak,
      joinUrl: record.joinUrl,
      hostUrl: record.hostUrl,
      role: 1,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not prepare Zoom credentials.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}