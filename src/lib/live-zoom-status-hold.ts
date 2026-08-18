/**
 * Client-side Zoom live-status helpers.
 * Instantly accept "coach is live"; hold the last live snapshot so a stale
 * poll / other serverless instance cannot flicker Join off.
 */

export type LiveZoomJoinBits = {
  sessionDate: string;
  roomReady: boolean;
  hostStarted: boolean;
  canJoin: boolean;
  joinUrl: string | null;
};

export const LIVE_ZOOM_NOT_LIVE_HOLD_MS = 8_000;

export function isLiveZoomJoinable(status: LiveZoomJoinBits | null | undefined): boolean {
  return Boolean(status?.canJoin && status?.joinUrl && status?.hostStarted);
}

export function sameLiveZoomStatus(
  a: LiveZoomJoinBits | null | undefined,
  b: LiveZoomJoinBits | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.sessionDate === b.sessionDate &&
    a.roomReady === b.roomReady &&
    a.hostStarted === b.hostStarted &&
    a.canJoin === b.canJoin &&
    a.joinUrl === b.joinUrl
  );
}

export function nextHeldLiveZoomStatus<T extends LiveZoomJoinBits>(
  current: T | null,
  incoming: T | null,
  hold: { notLiveSince: number | null },
  now: number,
  holdMs = LIVE_ZOOM_NOT_LIVE_HOLD_MS,
): { status: T | null; notLiveSince: number | null } {
  if (!incoming) {
    return { status: current, notLiveSince: hold.notLiveSince };
  }

  if (isLiveZoomJoinable(incoming)) {
    return { status: incoming, notLiveSince: null };
  }

  if (!isLiveZoomJoinable(current)) {
    return { status: incoming, notLiveSince: null };
  }

  const since = hold.notLiveSince ?? now;
  if (now - since < holdMs) {
    return { status: current, notLiveSince: since };
  }
  return { status: incoming, notLiveSince: null };
}
