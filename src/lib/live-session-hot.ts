import type { LiveWorkoutSession } from "@/lib/live-workout-session";

type Listener = (session: LiveWorkoutSession | null) => void;

declare global {
  // eslint-disable-next-line no-var
  var __tsLiveHot: Map<string, LiveWorkoutSession> | undefined;
  // eslint-disable-next-line no-var
  var __tsLiveSubs: Map<string, Set<Listener>> | undefined;
}

const hot = globalThis.__tsLiveHot ??= new Map<string, LiveWorkoutSession>();
const subs = globalThis.__tsLiveSubs ??= new Map<string, Set<Listener>>();

export function getHotLiveSession(key: string): LiveWorkoutSession | null {
  return hot.get(key) ?? null;
}

export function setHotLiveSession(key: string, session: LiveWorkoutSession | null): void {
  if (session) hot.set(key, session);
  else hot.delete(key);
  notify(key, session);
}

export function subscribeLiveSession(key: string, listener: Listener): () => void {
  let set = subs.get(key);
  if (!set) {
    set = new Set();
    subs.set(key, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) subs.delete(key);
  };
}

function notify(key: string, session: LiveWorkoutSession | null): void {
  const listeners = subs.get(key);
  if (!listeners) return;
  for (const listener of listeners) {
    try {
      listener(session);
    } catch {
      /* ignore subscriber errors */
    }
  }
}