import "server-only";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { normalizeDeviceId } from "@/lib/quick-auth-device";

export const DEVICE_ID_COOKIE = "ts_quick_auth_device";

export function deviceIdCookieOptions(maxAge = 365 * 24 * 60 * 60) {
  return {
    path: "/",
    maxAge,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function readQuickAuthDeviceCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return normalizeDeviceId(cookieStore.get(DEVICE_ID_COOKIE)?.value);
}

/** Prefer explicit body value; fall back to the device cookie (private-browser safe). */
export async function resolveQuickAuthDeviceId(bodyDeviceId: unknown): Promise<string | null> {
  const fromBody = normalizeDeviceId(bodyDeviceId);
  if (fromBody) return fromBody;
  return readQuickAuthDeviceCookie();
}

export async function ensureQuickAuthDeviceId(
  bodyDeviceId?: unknown,
): Promise<{ deviceId: string; created: boolean }> {
  const existing = await resolveQuickAuthDeviceId(bodyDeviceId);
  if (existing) return { deviceId: existing, created: false };
  return { deviceId: randomUUID().toLowerCase(), created: true };
}