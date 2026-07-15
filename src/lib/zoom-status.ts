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
  const s2sConfigured = zoomS2SConfigured();
  // Room start works via S2S *or* coach OAuth — do not require OAuth alone.
  const canCreateRooms = await zoomReady();
  const requiredHostEmail = zoomRequiredHostEmail();
  const wrongHostAccount =
    connected && record ? !isAllowedZoomHostEmail(record.email) : false;

  // Only block class start when the *only* path is a wrong OAuth user.
  // S2S can still host; coach should reconnect OAuth for recordings identity.
  const ready =
    canCreateRooms &&
    !(wrongHostAccount && !s2sConfigured);

  return {
    oauthAppConfigured: zoomOAuthAppConfigured(),
    s2sConfigured,
    connected,
    ready,
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