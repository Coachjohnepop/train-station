import "server-only";

import path from "path";
import { getBookings } from "@/lib/booking";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { normalizeLiveSessionDate } from "@/lib/live-workout-session";
import { getSessionsForDate, hydrateTodaySessions } from "@/lib/today-sessions";
import { createZoomMeeting } from "@/lib/zoom";

export type LiveClassZoomRecord = {
  sessionDate: string;
  meetingId: string;
  meetingNumber: string;
  joinUrl: string;
  hostUrl: string;
  password: string;
  topic: string;
  createdAt: string;
  notifiedAt?: string;
  hostStartedAt?: string;
  demo?: boolean;
};

type LiveClassZoomStore = Record<string, LiveClassZoomRecord>;

const BLOB_PATH = "coach/live-class-zoom.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "live-class-zoom.dev.json");

let memoryStore: LiveClassZoomStore | null = null;

async function loadStore(opts?: { preferFresh?: boolean }): Promise<LiveClassZoomStore> {
  const hydrated = await hydrateJsonStore<LiveClassZoomStore>({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = v;
    },
    fallback: () => ({}),
    preferFresh: opts?.preferFresh,
  });
  memoryStore = hydrated;
  return hydrated;
}

async function saveStore(store: LiveClassZoomStore): Promise<void> {
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v;
    },
  });
}

export async function getLiveClassZoom(sessionDate?: string): Promise<LiveClassZoomRecord | null> {
  const date = normalizeLiveSessionDate(sessionDate);
  const store = await loadStore({ preferFresh: true });
  return store[date] ?? null;
}

function sessionDateFromIso(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export async function memberHasLiveAccessOnDate(input: {
  memberEmail: string;
  userId?: string | null;
  sessionDate?: string;
}): Promise<boolean> {
  const date = normalizeLiveSessionDate(input.sessionDate);
  const email = input.memberEmail.toLowerCase();

  const bookings = await getBookings();
  const hasBooking = bookings.some((b: { memberEmail?: string; userId?: string; scheduledAt?: string; status?: string }) => {
    const emailMatch = b.memberEmail?.toLowerCase() === email;
    const userMatch = input.userId && b.userId === input.userId;
    if (!emailMatch && !userMatch) return false;
    if (b.status === "cancelled" || b.status === "completed") return false;
    if (!b.scheduledAt) return false;
    return sessionDateFromIso(b.scheduledAt) === date;
  });
  if (hasBooking) return true;

  await hydrateTodaySessions({ preferFresh: true });
  const daySessions = getSessionsForDate(date);
  if (input.userId && daySessions.some((s) => s.userIds.includes(input.userId!))) {
    return true;
  }

  // Also allow if they have a LiveWorkoutSession row for this date (class deploy / floor).
  if (input.userId) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const live = await prisma.liveWorkoutSession.findFirst({
        where: { userId: input.userId, sessionDate: date },
        select: { id: true },
      });
      if (live) return true;
    } catch {
      /* demo / no DB */
    }
  }

  return false;
}

export async function ensureLiveClassZoom(sessionDate?: string): Promise<{
  record: LiveClassZoomRecord;
  created: boolean;
}> {
  const date = normalizeLiveSessionDate(sessionDate);
  const store = await loadStore({ preferFresh: true });
  const existing = store[date];
  if (existing) {
    return { record: existing, created: false };
  }

  await hydrateTodaySessions({ preferFresh: true });
  const daySessions = getSessionsForDate(date);
  const scheduledAt =
    daySessions[0]?.scheduledAt != null
      ? new Date(daySessions[0].scheduledAt)
      : new Date(`${date}T12:00:00`);

  const zoom = await createZoomMeeting({
    bookingId: `live-class-${date}`,
    topic: `Train Station Live — ${date}`,
    scheduledAt,
    durationMin: 40,
  });

  const record: LiveClassZoomRecord = {
    sessionDate: date,
    meetingId: zoom.meetingId,
    meetingNumber: String(zoom.meetingId).replace(/\D/g, "") || zoom.meetingId,
    joinUrl: zoom.joinUrl,
    hostUrl: zoom.hostUrl,
    password: zoom.password || "",
    topic: `Train Station Live — ${date}`,
    createdAt: new Date().toISOString(),
    demo: zoom.demo,
  };

  store[date] = record;
  await saveStore(store);
  return { record, created: true };
}

export async function collectLiveClassAttendeeIds(sessionDate?: string): Promise<string[]> {
  const date = normalizeLiveSessionDate(sessionDate);
  await hydrateTodaySessions({ preferFresh: true });
  const daySessions = getSessionsForDate(date);
  const ids = new Set<string>();
  for (const session of daySessions) {
    for (const userId of session.userIds) ids.add(userId);
  }

  const bookings = await getBookings();
  for (const booking of bookings as Array<{ userId?: string; scheduledAt?: string; status?: string }>) {
    if (!booking.userId || !booking.scheduledAt) continue;
    if (booking.status === "cancelled" || booking.status === "completed") continue;
    if (sessionDateFromIso(booking.scheduledAt) === date) ids.add(booking.userId);
  }

  return Array.from(ids);
}

export async function notifyLiveClassZoomAttendees(
  sessionDate: string,
  joinUrl: string,
): Promise<{ sent: number }> {
  const userIds = await collectLiveClassAttendeeIds(sessionDate);
  if (userIds.length === 0) return { sent: 0 };

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.thetrainstation.co";
  const livePage = `${base}/member/live`;
  const customBody =
    `Live class Zoom is ready — tap to join: ${livePage}` +
    (joinUrl ? ` Direct Zoom: ${joinUrl}` : "");

  const { sendCoachChatAlert } = await import("@/lib/sms");
  const result = await sendCoachChatAlert({
    userIds,
    sessionDate,
    customBody,
    coachName: "Your coach",
  });
  return { sent: result.sent };
}

export async function markLiveClassZoomNotified(sessionDate?: string): Promise<void> {
  const date = normalizeLiveSessionDate(sessionDate);
  const store = await loadStore({ preferFresh: true });
  const record = store[date];
  if (!record || record.notifiedAt) return;
  store[date] = { ...record, notifiedAt: new Date().toISOString() };
  await saveStore(store);
}

export async function markLiveClassHostStarted(sessionDate?: string): Promise<void> {
  const date = normalizeLiveSessionDate(sessionDate);
  const store = await loadStore({ preferFresh: true });
  const record = store[date];
  if (!record) return;
  if (record.hostStartedAt) return;
  store[date] = { ...record, hostStartedAt: new Date().toISOString() };
  await saveStore(store);
}

export async function memberLiveZoomStatus(input: {
  memberEmail: string;
  userId?: string | null;
  sessionDate?: string;
}): Promise<{
  sessionDate: string;
  roomReady: boolean;
  hostStarted: boolean;
  canJoin: boolean;
  joinUrl: string | null;
  livePageUrl: string;
}> {
  const date = normalizeLiveSessionDate(input.sessionDate);
  const record = await getLiveClassZoom(date);

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.thetrainstation.co";
  const livePageUrl = `${base}/member/live`;

  if (!record) {
    return {
      sessionDate: date,
      roomReady: false,
      hostStarted: false,
      canJoin: false,
      joinUrl: null,
      livePageUrl,
    };
  }

  // If coach created a real class Zoom for today, members see Join (not Ping).
  // hostStartedAt refines copy; room existence is enough for the CTA.
  const hasJoin = Boolean(record.joinUrl) && !record.demo;
  const hostStarted = Boolean(record.hostStartedAt) || hasJoin;

  return {
    sessionDate: date,
    roomReady: hasJoin,
    hostStarted,
    canJoin: hasJoin,
    joinUrl: hasJoin ? record.joinUrl : null,
    livePageUrl,
  };
}