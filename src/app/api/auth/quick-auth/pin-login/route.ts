import { NextResponse } from "next/server";
import { normalizeAccountEmail } from "@/lib/account-email";
import { resolveUserByEmail } from "@/lib/auth";
import { buildLoginResponse } from "@/lib/complete-login";
import { isInvitedAccountEmail } from "@/lib/invited-accounts";
import {
  DEVICE_ID_COOKIE,
  deviceIdCookieOptions,
  resolveQuickAuthDeviceId,
} from "@/lib/quick-auth-device-cookie";
import { verifyPin } from "@/lib/quick-auth-pin";
import {
  materializePresetForDevice,
  resolvePinHashForDevice,
} from "@/lib/quick-auth-store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeAccountEmail(String(body.email || ""));
  const pin = String(body.pin || "");
  const deviceId = await resolveQuickAuthDeviceId(body.deviceId);
  const redirect = typeof body.redirect === "string" ? body.redirect : "";

  if (!email || !deviceId || !pin) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!(await isInvitedAccountEmail(email))) {
    return NextResponse.json({ error: "No quick sign-in for this account." }, { status: 403 });
  }

  const pinRecord = await resolvePinHashForDevice(email, deviceId);
  if (!pinRecord || !verifyPin(pin, pinRecord.pinHash)) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  if (pinRecord.fromPreset) {
    await materializePresetForDevice(email, deviceId);
  }

  const user = await resolveUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const res = await buildLoginResponse(user, { redirect });
  res.cookies.set(DEVICE_ID_COOKIE, deviceId, deviceIdCookieOptions());
  return res;
}