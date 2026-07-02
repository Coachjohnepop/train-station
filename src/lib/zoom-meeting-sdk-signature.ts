import "server-only";

import { SignJWT } from "jose";
import { zoomOAuthAppConfigured } from "@/lib/zoom-oauth-flow";

const MIN_EXP_SECONDS = 1800;

export function zoomMeetingSdkSecret(): string {
  return (
    process.env.ZOOM_MEETING_SDK_SECRET?.trim() ||
    process.env.ZOOM_CLIENT_SECRET?.trim() ||
    ""
  );
}

export function zoomMeetingSdkKey(): string {
  return process.env.ZOOM_MEETING_SDK_KEY?.trim() || process.env.ZOOM_CLIENT_ID?.trim() || "";
}

/** Meeting SDK JWT uses the same Client ID/Secret as the OAuth app (or dedicated SDK key pair). */
export function zoomMeetingSdkConfigured(): boolean {
  if (zoomOAuthAppConfigured()) return true;
  return Boolean(zoomMeetingSdkKey() && zoomMeetingSdkSecret());
}

export function zoomMeetingSdkConfigHint(): string {
  if (zoomMeetingSdkConfigured()) return "";
  return (
    "Add ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET in Vercel (Production), redeploy, " +
    "and enable Meeting SDK on your Zoom Marketplace app."
  );
}

export async function createZoomMeetingSdkSignature(input: {
  meetingNumber: string;
  role: 0 | 1;
  expirationSeconds?: number;
}): Promise<{ signature: string; sdkKey: string }> {
  const sdkKey = zoomMeetingSdkKey();
  const secret = zoomMeetingSdkSecret();
  if (!sdkKey || !secret) {
    throw new Error("Zoom Meeting SDK credentials are not configured.");
  }

  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + Math.max(MIN_EXP_SECONDS, input.expirationSeconds ?? 60 * 60 * 2);

  const signature = await new SignJWT({
    appKey: sdkKey,
    mn: input.meetingNumber,
    role: input.role,
    tokenExp: exp,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(secret));

  return { signature, sdkKey };
}