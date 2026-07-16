import "server-only";

import { ZOOM_FREE_MAX_DURATION_MIN, zoomOAuthAppConfigured } from "@/lib/zoom-oauth-flow";
import { zoomReady, zoomS2SConfigured } from "@/lib/zoom";
import { getZoomOAuthRecord } from "@/lib/zoom-oauth-store";
import {
  expectedZoomHostForCoach,
  isAllowedZoomHostForCoach,
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
  /** Expected Zoom login for this coach (their TS email or env host). */
  requiredHostEmail: string;
  /** Connected Zoom profile is not allowed for this coach. */
  wrongHostAccount: boolean;
  /** Multi-coach: status is scoped to this coach email. */
  coachEmail: string | null;
  account: {
    email: string;
    displayName: string;
    connectedAt: string;
    connectedByEmail: string;
  } | null;
};

export async function getZoomCoachStatus(coachEmail: string): Promise<ZoomCoachStatus> {
  const email = coachEmail.trim().toLowerCase();
  const record = email
    ? await getZoomOAuthRecord({ coachEmail: email, preferFresh: true })
    : null;
  const connected = Boolean(record?.refreshToken);
  const s2sConfigured = zoomS2SConfigured();
  const canCreateRooms = await zoomReady({ coachEmail: email || undefined });
  const requiredHostEmail = expectedZoomHostForCoach(email);
  const wrongHostAccount =
    connected && record
      ? !isAllowedZoomHostForCoach(record.email, email)
      : false;

  const ready = canCreateRooms && !(wrongHostAccount && !s2sConfigured);

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
    coachEmail: email || null,
    account:
      connected && record
        ? {
            email: record.email,
            displayName: record.displayName,
            connectedAt: record.connectedAt,
            connectedByEmail: record.connectedByEmail,
          }
        : null,
  };
}
