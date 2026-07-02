import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  DEVICE_ID_COOKIE,
  deviceIdCookieOptions,
  resolveQuickAuthDeviceId,
} from "@/lib/quick-auth-device-cookie";
import { isValidPin } from "@/lib/quick-auth-pin";
import { confirmPinPersisted, setAdminPinForEmail } from "@/lib/quick-auth-store";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const pin = String(body.pin || "");
  const deviceId = await resolveQuickAuthDeviceId(body.deviceId);

  if (!deviceId) {
    return NextResponse.json({ error: "Invalid device." }, { status: 400 });
  }
  if (!isValidPin(pin)) {
    return NextResponse.json({ error: "PIN must be 4 digits." }, { status: 400 });
  }

  try {
    // Sync preset + all registered devices so change-PIN works everywhere.
    await setAdminPinForEmail(session.email, pin, { deviceId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not save PIN.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const persisted = await confirmPinPersisted(session.email, deviceId, pin);
  if (!persisted) {
    return NextResponse.json(
      { error: "PIN could not be verified after save — try again." },
      { status: 503 },
    );
  }

  const res = NextResponse.json({ ok: true, pin: true });
  res.cookies.set(DEVICE_ID_COOKIE, deviceId, deviceIdCookieOptions());
  return res;
}