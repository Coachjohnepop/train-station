import { NextResponse } from "next/server";
import { normalizeAccountEmail } from "@/lib/account-email";
import { resolveQuickAuthDeviceId } from "@/lib/quick-auth-device-cookie";
import { materializePresetForDevice, quickAuthStatusForDevice } from "@/lib/quick-auth-store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeAccountEmail(String(body.email || ""));
  const deviceId = await resolveQuickAuthDeviceId(body.deviceId);

  if (!email || !deviceId) {
    return NextResponse.json({ pin: false, webauthn: false, enabled: false });
  }

  await materializePresetForDevice(email, deviceId);
  const status = await quickAuthStatusForDevice(email, deviceId, { preferFresh: true });
  if (!status) {
    return NextResponse.json({ pin: false, webauthn: false, enabled: false });
  }

  return NextResponse.json({
    ...status,
    enabled: status.pin || status.webauthn,
  });
}