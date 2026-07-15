import "server-only";

import { ZOOM_FREE_MAX_DURATION_MIN, zoomOAuthAppConfigured } from "@/lib/zoom-oauth-flow";
import { zoomReady, zoomS2SConfigured } from "@/lib/zoom";
import { getZoomOAuthRecord } from "@/lib/zoom-oauth-store";
import {
  zoomMeetingSdkConfigHint,
  zoomMeetingSdkConfigured,
} from "@/lib/zoom-meeting-sdk-signature";

export type ZoomCoachStatus = {
  oauthAppConfigured: boolean;
  s2sConfigured: boolean;
  connected: boolean;
  ready: boolean;
  sdkConfigured: boolean;
  sdkConfigHint: string | null;
  maxDurationMin: number;
  coachStartsFirst: boolean;
  account: {
    email: string;
    displayName: string;
    connectedAt: string;
    connectedByEmail: string;
  } | null;
};

export async function getZoomCoachStatus(): Promise<ZoomCoachStatus> {
  const record = await getZoomOAuthRecord({ preferFresh: true });
  const connected = Boolean(record?.refreshToken);
  const ready = await zoomReady();

  return {
    oauthAppConfigured: zoomOAuthAppConfigured(),
    s2sConfigured: zoomS2SConfigured(),
    connected,
    ready: connected && ready,
    sdkConfigured: zoomMeetingSdkConfigured(),
    sdkConfigHint: zoomMeetingSdkConfigHint() || null,
    maxDurationMin: ZOOM_FREE_MAX_DURATION_MIN,
    coachStartsFirst: true,
    account: connected && record
      ? {
          email: record.email,
          displayName: record.displayName,
          connectedAt: record.connectedAt,
          connectedByEmail: record.connectedByEmail,
        }
      : null,
  };
}