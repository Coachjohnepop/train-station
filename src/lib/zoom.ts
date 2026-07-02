import "server-only";

export type ZoomMeetingResult = {
  meetingId: string;
  joinUrl: string;
  hostUrl: string;
  demo?: boolean;
};

type ZoomCredentials = {
  accountId: string;
  clientId: string;
  clientSecret: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

export function zoomConfigured(): boolean {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID?.trim() &&
      process.env.ZOOM_CLIENT_ID?.trim() &&
      process.env.ZOOM_CLIENT_SECRET?.trim(),
  );
}

function getCredentials(): ZoomCredentials | null {
  const accountId = process.env.ZOOM_ACCOUNT_ID?.trim();
  const clientId = process.env.ZOOM_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOOM_CLIENT_SECRET?.trim();
  if (!accountId || !clientId || !clientSecret) return null;
  return { accountId, clientId, clientSecret };
}

async function getZoomAccessToken(): Promise<string> {
  const creds = getCredentials();
  if (!creds) throw new Error("Zoom is not configured.");

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
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
  cachedToken = { value: token, expiresAt: now + expiresIn * 1000 };
  return token;
}

function demoMeeting(bookingId: string, topic: string): ZoomMeetingResult {
  const slug = bookingId.replace(/[^a-zA-Z0-9]/g, "").slice(-10) || "demo";
  return {
    meetingId: `demo-${slug}`,
    joinUrl: `https://zoom.us/j/demo-${slug}`,
    hostUrl: `https://zoom.us/s/demo-${slug}?zak=demo`,
    demo: true,
  };
}

export async function createZoomMeeting(input: {
  bookingId: string;
  topic: string;
  scheduledAt: Date;
  durationMin: number;
  timezone?: string;
}): Promise<ZoomMeetingResult> {
  if (!zoomConfigured()) {
    return demoMeeting(input.bookingId, input.topic);
  }

  const token = await getZoomAccessToken();
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
      duration: input.durationMin,
      timezone,
      settings: {
        join_before_host: true,
        waiting_room: true,
        approval_type: 2,
        auto_recording: "none",
      },
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
  };
}