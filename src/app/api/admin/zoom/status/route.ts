import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import { ZOOM_FREE_MAX_DURATION_MIN, zoomOAuthAppConfigured } from "@/lib/zoom-oauth-flow";
import { zoomReady, zoomS2SConfigured } from "@/lib/zoom";
import { getZoomOAuthRecord } from "@/lib/zoom-oauth-store";
import {
  zoomMeetingSdkConfigHint,
  zoomMeetingSdkConfigured,
} from "@/lib/zoom-meeting-sdk-signature";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const record = await getZoomOAuthRecord();
  const ready = await zoomReady();

  return NextResponse.json({
    oauthAppConfigured: zoomOAuthAppConfigured(),
    s2sConfigured: zoomS2SConfigured(),
    connected: Boolean(record?.refreshToken),
    ready,
    sdkConfigured: zoomMeetingSdkConfigured(),
    sdkConfigHint: zoomMeetingSdkConfigHint() || null,
    maxDurationMin: ZOOM_FREE_MAX_DURATION_MIN,
    coachStartsFirst: true,
    account: record
      ? {
          email: record.email,
          displayName: record.displayName,
          connectedAt: record.connectedAt,
        }
      : null,
  });
}