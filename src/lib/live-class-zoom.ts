import "server-only";

import path from "path";
import { getBookings } from "@/lib/booking";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import {
  getLiveClassZoomFromDb,
  upsertLiveClassZoomToDb,
} from "@/lib/live-class-zoom-db";
import {
  getHotLiveClassZoom,
  setHotLiveClassZoom,
} from "@/lib/live-class-zoom-hot";
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
  /** Train Station coach login that owns this room's Zoom host (start_url). */
  hostCoachEmail?: string | null;
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
  // Publish hot immediately so SSE members flip to Join without waiting on Blob CDN.
  for (const [date, record] of Object.entries(store)) {
    setHotLiveClassZoom(date, record);
  }
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v;
    },
  });
}

async function publishRecord(record: LiveClassZoomRecord): Promise<void> {
  setHotLiveClassZoom(record.sessionDate, record);
  // Await so other instances see hostStarted on the next member poll (no Join flicker).
  await upsertLiveClassZoomToDb(record.sessionDate, record);
}

function hostStartedAtMs(record: LiveClassZoomRecord | null | undefined): number {
  if (!record?.hostStartedAt) return 0;
  const started = new Date(record.hostStartedAt).getTime();
  return Number.isNaN(started) ? 0 : started;
}

function preferRicherLiveClassZoom(
  a: LiveClassZoomRecord | null | undefined,
  b: LiveClassZoomRecord | null | undefined,
): LiveClassZoomRecord | null {
  if (!a) return b ?? null;
  if (!b) return a;
  const aStart = hostStartedAtMs(a);
  const bStart = hostStartedAtMs(b);
  if (bStart > aStart) return b;
  if (aStart > bStart) return a;
  if (!a.joinUrl && b.joinUrl) return b;
  return a;
}

export async function getLiveClassZoom(sessionDate?: string): Promise<LiveClassZoomRecord | null> {
  const date = normalizeLiveSessionDate(sessionDate);

  const hot = getHotLiveClassZoom(date);
  if (hot) return hot;

  const fromDb = await getLiveClassZoomFromDb(date);
  const hotAfterDb = getHotLiveClassZoom(date);
  const best = preferRicherLiveClassZoom(hotAfterDb, fromDb);
  if (best) {
    setHotLiveClassZoom(date, best);
    return best;
  }

  const store = await loadStore({ preferFresh: true });
  const record = store[date] ?? null;
  if (record) {
    setHotLiveClassZoom(date, record);
    void upsertLiveClassZoomToDb(date, record);
  }
  return record;
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

/**
 * Prefer the primary host (Jeremy) OAuth for the shared class room so other coaches
 * join as participants instead of creating a second host meeting.
 */
export async function resolveLiveClassHostCoachEmail(
  requestingCoachEmail?: string | null,
): Promise<string | null> {
  const request = (requestingCoachEmail || "").trim().toLowerCase() || null;
  const preferred =
    process.env.ZOOM_LIVE_CLASS_HOST_EMAIL?.trim().toLowerCase() ||
    process.env.ZOOM_HOST_EMAIL?.trim().toLowerCase() ||
    "jeremy@thetrainstation.co";

  const { getZoomOAuthRecord } = await import("@/lib/zoom-oauth-store");
  const preferredRec = await getZoomOAuthRecord({
    coachEmail: preferred,
    preferFresh: true,
  });
  if (preferredRec?.refreshToken) return preferred;

  if (request) {
    const reqRec = await getZoomOAuthRecord({
      coachEmail: request,
      preferFresh: true,
    });
    if (reqRec?.refreshToken) return request;
  }
  return request || preferred;
}

/** True when this coach should open start_url; others use join_url to enter as guests. */
export function isLiveClassHostForCoach(
  record: LiveClassZoomRecord | null | undefined,
  coachEmail?: string | null,
): boolean {
  if (!record || !coachEmail) return false;
  const coach = coachEmail.trim().toLowerCase();
  const host =
    (record.hostCoachEmail || "").trim().toLowerCase() ||
    process.env.ZOOM_LIVE_CLASS_HOST_EMAIL?.trim().toLowerCase() ||
    process.env.ZOOM_HOST_EMAIL?.trim().toLowerCase() ||
    "jeremy@thetrainstation.co";
  return coach === host;
}

export function liveClassOpenUrlForCoach(
  record: LiveClassZoomRecord,
  coachEmail?: string | null,
): { openUrl: string; openAs: "host" | "participant"; isHost: boolean } {
  const isHost = isLiveClassHostForCoach(record, coachEmail);
  if (isHost && record.hostUrl) {
    return { openUrl: record.hostUrl, openAs: "host", isHost: true };
  }
  return {
    openUrl: record.joinUrl || record.hostUrl,
    openAs: "participant",
    isHost: false,
  };
}

export async function ensureLiveClassZoom(
  sessionDate?: string,
  opts?: { coachEmail?: string | null },
): Promise<{
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

  const hostCoachEmail = await resolveLiveClassHostCoachEmail(opts?.coachEmail);

  const zoom = await createZoomMeeting({
    bookingId: `live-class-${date}`,
    topic: `Train Station Live — ${date}`,
    scheduledAt,
    durationMin: 40,
    // Always create under preferred host when connected so co-coaches join Jeremy.
    coachEmail: hostCoachEmail,
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
    hostCoachEmail,
  };

  store[date] = record;
  await saveStore(store);
  await publishRecord(record);
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
  const record = store[date] ?? getHotLiveClassZoom(date);
  if (!record || record.notifiedAt) return;
  const next = { ...record, notifiedAt: new Date().toISOString() };
  store[date] = next;
  // Hot first — members listening on SSE flip immediately.
  await publishRecord(next);
  await saveStore(store);
}

/** How long members keep seeing "Join Live" after the coach starts hosting. */
export const LIVE_CLASS_HOST_ACTIVE_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function markLiveClassHostStarted(sessionDate?: string): Promise<void> {
  const date = normalizeLiveSessionDate(sessionDate);
  const store = await loadStore({ preferFresh: true });
  const record = store[date] ?? getHotLiveClassZoom(date);
  if (!record) return;
  // Always refresh start time when coach re-starts so members get a fresh window.
  const next = { ...record, hostStartedAt: new Date().toISOString() };
  store[date] = next;
  // Hot + DB first so member Join is instant; Blob follows.
  await publishRecord(next);
  await saveStore(store);
}

/** Clear the member-facing "coach is live" flag (room link may remain for re-start). */
export async function clearLiveClassHostStarted(sessionDate?: string): Promise<void> {
  const date = normalizeLiveSessionDate(sessionDate);
  const store = await loadStore({ preferFresh: true });
  const record = store[date] ?? getHotLiveClassZoom(date);
  if (!record || !record.hostStartedAt) return;
  const { hostStartedAt: _drop, ...rest } = record;
  const next = rest as LiveClassZoomRecord;
  store[date] = next;
  await publishRecord(next);
  await saveStore(store);
}

/**
 * True only while the coach has marked themselves live and the window hasn't expired.
 * Creating a meeting alone is NOT enough — members must not see Join until host starts.
 */
export function isLiveClassHostActive(
  record: LiveClassZoomRecord | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!record?.hostStartedAt) return false;
  if (record.demo) return false;
  if (!record.joinUrl) return false;
  const started = new Date(record.hostStartedAt).getTime();
  if (Number.isNaN(started)) return false;
  return nowMs - started < LIVE_CLASS_HOST_ACTIVE_MS;
}

/** True only when the 2h host window has elapsed — not when joinUrl is briefly missing. */
export function isLiveClassHostWindowExpired(
  record: LiveClassZoomRecord | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!record?.hostStartedAt) return false;
  const started = new Date(record.hostStartedAt).getTime();
  if (Number.isNaN(started)) return false;
  return nowMs - started >= LIVE_CLASS_HOST_ACTIVE_MS;
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
  let record = await getLiveClassZoom(date);

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

  // Auto-clear only after the 2h window. A missing joinUrl on a stale blob
  // must not wipe hostStartedAt — that flickered Join for members.
  if (isLiveClassHostWindowExpired(record)) {
    await clearLiveClassHostStarted(date);
    record = (await getLiveClassZoom(date)) || record;
  }

  const hasJoin = Boolean(record.joinUrl) && !record.demo;
  const hostStarted = isLiveClassHostActive(record);
  // Members may join only while the coach is actively hosting — not merely because
  // a Zoom meeting object exists for today's date.
  const canJoin = hasJoin && hostStarted;

  return {
    sessionDate: date,
    roomReady: hasJoin,
    hostStarted,
    canJoin,
    joinUrl: canJoin ? record.joinUrl : null,
    livePageUrl,
  };
}