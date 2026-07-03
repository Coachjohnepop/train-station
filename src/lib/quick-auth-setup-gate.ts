import "server-only";

import { readQuickAuthDeviceCookie } from "@/lib/quick-auth-device-cookie";
import {
  materializePresetForDevice,
  quickAuthStatusForDevice,
} from "@/lib/quick-auth-store";
import {
  quickAuthSetupUrl,
  shouldOfferQuickAuthSetup,
} from "@/lib/quick-auth-redirect";

export async function quickAuthEnabledForDevice(
  email: string,
  deviceId: string,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !deviceId) return false;
  await materializePresetForDevice(normalized, deviceId);
  const status = await quickAuthStatusForDevice(normalized, deviceId, {
    preferFresh: true,
  });
  return Boolean(status?.pin || status?.webauthn);
}

/** After login, only interrupt with setup when this device has no quick sign-in yet. */
export async function resolvePostLoginDestination(
  email: string,
  destination: string,
): Promise<string> {
  if (!shouldOfferQuickAuthSetup(destination)) return destination;
  const deviceId = await readQuickAuthDeviceCookie();
  if (!deviceId) return quickAuthSetupUrl(destination);
  const enabled = await quickAuthEnabledForDevice(email, deviceId);
  return enabled ? destination : quickAuthSetupUrl(destination);
}