import "server-only";

import {
  capZoomDurationMin,
  zoomOAuthAppConfigured,
  zoomOAuthCallbackUrl,
  ZOOM_FREE_MAX_DURATION_MIN,
} from "@/lib/zoom-oauth-flow";
import { getZoomOAuthRecord, isZoomCoachConnected } from "@/lib/zoom-oauth-store";
import { zoomAccountId, zoomClientId, zoomClientSecret } from "@/lib/zoom-env";

export type ZoomMeetingResult = {
  meetingId: string;
  joinUrl: string;
  hostUrl: string;
  password: string;
  durationMin: number;
  demo?: boolean;
};

export { ZOOM_FREE_MAX_DURATION_MIN };

type ZoomCredentials = {
  accountId: string;
  clientId: string;
  clientSecret: string;
};

let cachedS2SToken: { value: string; expiresAt: number } | null = null;
let cachedUserToken: { value: string; expiresAt: number } | null = null;

export function zoomS2SConfigured(): boolean {
  return Boolean(zoomAccountId() && zoomClientId() && zoomClientSecret());
}

export function zoomConfigured(): boolean {
  return zoomS2SConfigured() || zoomOAuthAppConfigured();
}

export async function zoomReady(): Promise<boolean> {
  if (zoomS2SConfigured()) return true;
  if (zoomOAuthAppConfigured() && (await isZoomCoachConnected())) return true;
  return false;
}

function getOAuthClientPair(): { clientId: string; clientSecret: string } | null {
  const clientId = zoomClientId();
  const clientSecret = zoomClientSecret();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function getS2SCredentials(): ZoomCredentials | null {
  const accountId = zoomAccountId();
  const pair = getOAuthClientPair();
  if (!accountId || !pair) return null;
  return { accountId, clientId: pair.clientId, clientSecret: pair.clientSecret };
}

async function exchangeZoomToken(body: URLSearchParams): Promise<string> {
  const pair = getOAuthClientPair();
  if (!pair) throw new Error("Zoom OAuth app is not configured.");

  const basic = Buffer.from(`${pair.clientId}:${pair.clientSecret}`).toString("base64");
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.reason || data?.error || `Zoom token exchange failed (${res.status})`);
  }

  return data.access_token as string;
}

async function getZoomS2SAccessToken(): Promise<string> {
  const creds = getS2SCredentials();
  if (!creds) throw new Error("Zoom Server-to-Server is not configured.");

  const now = Date.now();
  if (cachedS2SToken && cachedS2SToken.expiresAt > now + 60_000) {
    return cachedS2SToken.value;
  }

  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  const params = new URLSearchParams({
    grant_type: "account_credentials",
    account_id: creds.accountId,
  });

  const res = await fetch(`https://zoom.us/oauth/token?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.reason || data?.error || `Zoom auth failed (${res.status})`);
  }

  const token = data.access_token as string;
  const expiresIn = Number(data.expires_in) || 3600;
  cachedS2SToken = { value: token, expiresAt: now + expiresIn * 1000 };
  return token;
}

async function getZoomUserAccessToken(): Promise<string | null> {
  const record = await getZoomOAuthRecord();
  if (!record?.refreshToken) return null;

  const now = Date.now();
  if (cachedUserToken && cachedUserToken.expiresAt > now + 60_000) {
    return cachedUserToken.value;
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: record.refreshToken,
  });

  const token = await exchangeZoomToken(params);
  cachedUserToken = { value: token, expiresAt: now + 3500 * 1000 };
  return token;
}

async function resolveZoomAccessToken(): Promise<string | null> {
  const userToken = await getZoomUserAccessToken();
  if (userToken) return userToken;
  if (zoomS2SConfigured()) return getZoomS2SAccessToken();
  return null;
}

function demoMeeting(bookingId: string): ZoomMeetingResult {
  const slug = bookingId.replace(/[^a-zA-Z0-9]/g, "").slice(-10) || "demo";
  return {
    meetingId: `demo-${slug}`,
    joinUrl: `https://zoom.us/j/demo-${slug}`,
    hostUrl: `https://zoom.us/s/demo-${slug}?zak=demo`,
    password: "",
    durationMin: ZOOM_FREE_MAX_DURATION_MIN,
    demo: true,
  };
}

function freeTierMeetingSettings() {
  return {
    join_before_host: false,
    waiting_room: true,
    approval_type: 2,
    auto_recording: "none",
    host_video: true,
    participant_video: true,
  };
}

export async function createZoomMeeting(input: {
  bookingId: string;
  topic: string;
  scheduledAt: Date;
  durationMin: number;
  timezone?: string;
}): Promise<ZoomMeetingResult> {
  const durationMin = capZoomDurationMin(input.durationMin);
  const token = await resolveZoomAccessToken();
  if (!token) return { ...demoMeeting(input.bookingId), durationMin };

  const timezone = input.timezone || process.env.ZOOM_TIMEZONE?.trim() || "America/Los_Angeles";

  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: input.topic,
      type: 2,
      start_time: input.scheduledAt.toISOString(),
      duration: durationMin,
      timezone,
      settings: freeTierMeetingSettings(),
    }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Zoom meeting create failed (${res.status})`);
  }

  return {
    meetingId: String(data.id),
    joinUrl: data.join_url,
    hostUrl: data.start_url,
    password: data.password || "",
    durationMin,
  };
}

export async function fetchZoomZakToken(): Promise<string | null> {
  const token = await resolveZoomAccessToken();
  if (!token) return null;

  const res = await fetch("https://api.zoom.us/v2/users/me/token?type=zak", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Could not fetch Zoom ZAK token (${res.status})`);
  }
  return (data.token as string) || null;
}

export async function exchangeZoomAuthCode(
  code: string,
  redirectUri?: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    // Must match the redirect_uri used in /oauth/authorize exactly.
    redirect_uri: redirectUri || zoomOAuthCallbackUrl(),
  });
  const pair = getOAuthClientPair();
  if (!pair) throw new Error("Zoom OAuth app is not configured.");

  const basic = Buffer.from(`${pair.clientId}:${pair.clientSecret}`).toString("base64");
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.reason || data?.error || `Zoom code exchange failed (${res.status})`);
  }

  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
  };
}

export async function fetchZoomUserProfile(accessToken: string): Promise<{
  id: string;
  email: string;
  displayName: string;
}> {
  const res = await fetch("https://api.zoom.us/v2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Could not read Zoom profile.");
  }
  return {
    id: String(data.id),
    email: data.email || "",
    displayName: `${data.first_name || ""} ${data.last_name || ""}`.trim() || data.email || "Coach",
  };
}