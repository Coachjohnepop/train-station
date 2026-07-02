import "server-only";

import { SignJWT } from "jose";

const MIN_EXP_SECONDS = 1800;

export function zoomMeetingSdkConfigured(): boolean {
  return Boolean(
    process.env.ZOOM_CLIENT_ID?.trim() && process.env.ZOOM_CLIENT_SECRET?.trim(),
  );
}

export function zoomMeetingSdkKey(): string {
  return process.env.ZOOM_MEETING_SDK_KEY?.trim() || process.env.ZOOM_CLIENT_ID?.trim() || "";
}

export async function createZoomMeetingSdkSignature(input: {
  meetingNumber: string;
  role: 0 | 1;
  expirationSeconds?: number;
}): Promise<{ signature: string; sdkKey: string }> {
  const sdkKey = zoomMeetingSdkKey();
  const secret = process.env.ZOOM_MEETING_SDK_SECRET?.trim() || process.env.ZOOM_CLIENT_SECRET?.trim();
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