import { NextResponse } from "next/server";
import { normalizeDeviceId } from "@/lib/quick-auth-device";
import {
  DEVICE_ID_COOKIE,
  deviceIdCookieOptions,
  ensureQuickAuthDeviceId,
  readQuickAuthDeviceCookie,
} from "@/lib/quick-auth-device-cookie";

function attachDeviceCookie(res: NextResponse, deviceId: string) {
  res.cookies.set(DEVICE_ID_COOKIE, deviceId, deviceIdCookieOptions());
}

export async function GET() {
  const existing = await readQuickAuthDeviceCookie();
  if (existing) {
    return NextResponse.json({ deviceId: existing, created: false });
  }

  const { deviceId } = await ensureQuickAuthDeviceId();
  const res = NextResponse.json({ deviceId, created: true });
  attachDeviceCookie(res, deviceId);
  return res;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const requested = normalizeDeviceId(body.deviceId);
  const existing = await readQuickAuthDeviceCookie();

  const deviceId = existing || requested || (await ensureQuickAuthDeviceId()).deviceId;
  const created = !existing && !requested;

  const res = NextResponse.json({ deviceId, created });
  if (!existing) {
    attachDeviceCookie(res, deviceId);
  }
  return res;
}