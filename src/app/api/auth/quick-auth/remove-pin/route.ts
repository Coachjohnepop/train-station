import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { resolveQuickAuthDeviceId } from "@/lib/quick-auth-device-cookie";
import { clearPinForDevice } from "@/lib/quick-auth-store";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const deviceId = await resolveQuickAuthDeviceId(body.deviceId);
  if (!deviceId) {
    return NextResponse.json({ error: "Invalid device." }, { status: 400 });
  }

  await clearPinForDevice(session.email, deviceId);
  return NextResponse.json({ ok: true, pin: false });
}