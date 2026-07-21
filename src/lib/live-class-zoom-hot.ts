import type { LiveClassZoomRecord } from "@/lib/live-class-zoom";

type Listener = (record: LiveClassZoomRecord | null, sessionDate: string) => void;

declare global {
  // eslint-disable-next-line no-var
  var __tsLiveClassZoomHot: Map<string, LiveClassZoomRecord> | undefined;
  // eslint-disable-next-line no-var
  var __tsLiveClassZoomSubs: Map<string, Set<Listener>> | undefined;
  // eslint-disable-next-line no-var
  var __tsLiveClassZoomAnySubs: Set<Listener> | undefined;
}

const hot = globalThis.__tsLiveClassZoomHot ??= new Map<string, LiveClassZoomRecord>();
const subs = globalThis.__tsLiveClassZoomSubs ??= new Map<string, Set<Listener>>();
const anySubs = globalThis.__tsLiveClassZoomAnySubs ??= new Set<Listener>();

export function getHotLiveClassZoom(sessionDate: string): LiveClassZoomRecord | null {
  return hot.get(sessionDate) ?? null;
}

export function setHotLiveClassZoom(
  sessionDate: string,
  record: LiveClassZoomRecord | null,
): void {
  if (record) hot.set(sessionDate, record);
  else hot.delete(sessionDate);
  notify(sessionDate, record);
}

export function subscribeLiveClassZoom(
  sessionDate: string,
  listener: Listener,
): () => void {
  let set = subs.get(sessionDate);
  if (!set) {
    set = new Set();
    subs.set(sessionDate, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) subs.delete(sessionDate);
  };
}

/** Subscribe to any date (member status uses app "today"). */
export function subscribeAnyLiveClassZoom(listener: Listener): () => void {
  anySubs.add(listener);
  return () => {
    anySubs.delete(listener);
  };
}

function notify(sessionDate: string, record: LiveClassZoomRecord | null): void {
  const daySubs = subs.get(sessionDate);
  if (daySubs) {
    for (const listener of daySubs) {
      try {
        listener(record, sessionDate);
      } catch {
        /* ignore */
      }
    }
  }
  for (const listener of anySubs) {
    try {
      listener(record, sessionDate);
    } catch {
      /* ignore */
    }
  }
}
