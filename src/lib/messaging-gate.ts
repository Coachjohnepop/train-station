import "server-only";

import { getCoachSettings } from "@/lib/coach-settings-store";

let cachedEnabled: boolean | null = null;
let cachedAt = 0;
const CACHE_MS = 3000;

/** Hard kill switch — set MESSAGING_ENABLED=false on Vercel to override admin UI. */
function envMessagingOverride(): boolean | null {
  const raw = process.env.MESSAGING_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  if (raw === "true" || raw === "1" || raw === "on") return true;
  return null;
}

export function invalidateMessagingGateCache(): void {
  cachedEnabled = null;
  cachedAt = 0;
}

/** When false, outbound Resend email and carrier SMS are suppressed (in-app chat still works). */
export async function isOutboundMessagingEnabled(): Promise<boolean> {
  const env = envMessagingOverride();
  if (env !== null) return env;

  const now = Date.now();
  if (cachedEnabled !== null && now - cachedAt < CACHE_MS) {
    return cachedEnabled;
  }

  const settings = await getCoachSettings();
  cachedEnabled = settings.messagingEnabled !== false;
  cachedAt = now;
  return cachedEnabled;
}

export async function getMessagingGateStatus(): Promise<{
  enabled: boolean;
  source: "env" | "admin" | "default";
}> {
  const env = envMessagingOverride();
  if (env !== null) {
    return { enabled: env, source: "env" };
  }
  const settings = await getCoachSettings();
  if (settings.messagingEnabled === false) {
    return { enabled: false, source: "admin" };
  }
  return { enabled: true, source: settings.messagingEnabled === true ? "admin" : "default" };
}