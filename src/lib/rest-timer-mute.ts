/** Local rest-timer mute — this device only. Partner still hears. */

export const REST_MUTE_KEY = "ts-rest-timer-mute";

type MuteStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function defaultStore(): MuteStore | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readRestTimerMuted(store: MuteStore | null = defaultStore()): boolean {
  try {
    return store?.getItem(REST_MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeRestTimerMuted(
  muted: boolean,
  store: MuteStore | null = defaultStore(),
): void {
  if (!store) return;
  try {
    if (muted) store.setItem(REST_MUTE_KEY, "1");
    else store.removeItem(REST_MUTE_KEY);
  } catch {
    /* private mode */
  }
}

/** Horn / ticks / start chirp — mute is immediate, not next render. */
export function restSoundAllowed(muted: boolean): boolean {
  return !muted;
}
