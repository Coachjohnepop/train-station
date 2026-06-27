import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  DEVICE_ID_COOKIE,
  deviceIdCookieOptions,
  resolveQuickAuthDeviceId,
} from "@/lib/quick-auth-device-cookie";
import { hashPin, isValidPin } from "@/lib/quick-auth-pin";
import { getDeviceQuickAuth, upsertDeviceQuickAuth } from "@/lib/quick-auth-store";

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
    return NextResponse.json({ error: "PIN must be 4–6 digits." }, { status: 400 });
  }

  const existing = (await getDeviceQuickAuth(session.email, deviceId)) ?? {
    email: session.email,
    deviceId,
    updatedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  await upsertDeviceQuickAuth({
    ...existing,
    email: session.email,
    deviceId,
    pinHash: hashPin(pin),
    pinUpdatedAt: now,
    updatedAt: now,
  });

  const res = NextResponse.json({ ok: true, pin: true });
  res.cookies.set(DEVICE_ID_COOKIE, deviceId, deviceIdCookieOptions());
  return res;
}