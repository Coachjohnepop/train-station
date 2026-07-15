import "server-only";

import { ZOOM_FREE_MAX_DURATION_MIN, zoomOAuthAppConfigured } from "@/lib/zoom-oauth-flow";
import { zoomReady, zoomS2SConfigured } from "@/lib/zoom";
import { getZoomOAuthRecord } from "@/lib/zoom-oauth-store";
import {
  isAllowedZoomHostEmail,
  zoomRequiredHostEmail,
} from "@/lib/zoom-env";
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
  /** Zoom login that must host class / hold recordings. */
  requiredHostEmail: string;
  /** Connected but not the required host (should reconnect). */
  wrongHostAccount: boolean;
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
  const requiredHostEmail = zoomRequiredHostEmail();
  const wrongHostAccount =
    connected && record ? !isAllowedZoomHostEmail(record.email) : false;

  return {
    oauthAppConfigured: zoomOAuthAppConfigured(),
    s2sConfigured: zoomS2SConfigured(),
    connected,
    // Not "ready" for class if the wrong Zoom user is linked.
    ready: connected && ready && !wrongHostAccount,
    sdkConfigured: zoomMeetingSdkConfigured(),
    sdkConfigHint: zoomMeetingSdkConfigHint() || null,
    maxDurationMin: ZOOM_FREE_MAX_DURATION_MIN,
    coachStartsFirst: true,
    requiredHostEmail,
    wrongHostAccount,
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