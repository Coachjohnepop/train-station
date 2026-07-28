/**
 * Member Zoom chrome state for a given class day (sessionDate YYYY-MM-DD).
 * - joined: they tapped Join (optimistic — we can't reliably detect "in Zoom app")
 * - chipHidden: they tucked the post-join chip away
 */

function joinedKey(sessionDate: string) {
  return `ts-zoom-joined:${sessionDate}`;
}

function chipHiddenKey(sessionDate: string) {
  return `ts-zoom-chip-hidden:${sessionDate}`;
}

export function readZoomJoined(sessionDate: string): boolean {
  if (typeof window === "undefined" || !sessionDate) return false;
  try {
    return localStorage.getItem(joinedKey(sessionDate)) === "1";
  } catch {
    return false;
  }
}

export function writeZoomJoined(sessionDate: string, joined: boolean): void {
  if (typeof window === "undefined" || !sessionDate) return;
  try {
    if (joined) localStorage.setItem(joinedKey(sessionDate), "1");
    else localStorage.removeItem(joinedKey(sessionDate));
  } catch {
    /* ignore */
  }
}

export function readZoomChipHidden(sessionDate: string): boolean {
  if (typeof window === "undefined" || !sessionDate) return false;
  try {
    return localStorage.getItem(chipHiddenKey(sessionDate)) === "1";
  } catch {
    return false;
  }
}

export function writeZoomChipHidden(sessionDate: string, hidden: boolean): void {
  if (typeof window === "undefined" || !sessionDate) return;
  try {
    if (hidden) localStorage.setItem(chipHiddenKey(sessionDate), "1");
    else localStorage.removeItem(chipHiddenKey(sessionDate));
  } catch {
    /* ignore */
  }
}

/** Call when member taps Join Live Zoom — persists joined + shows chip (not hidden). */
export function markZoomJoined(sessionDate: string): void {
  writeZoomJoined(sessionDate, true);
  writeZoomChipHidden(sessionDate, false);
}
