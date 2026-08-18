/**
 * Hard floor for any setInterval that hits the network / Postgres.
 * A 150ms live-session loop blew Free-tier usage. Do not go under this.
 */
export const MIN_NETWORK_POLL_MS = 5_000;

/** Backup poll while coach has started live class. Idle pages do not interval. */
export const LIVE_CLASS_POLL_MS = MIN_NETWORK_POLL_MS;

export function isLiveClassSessionGoing(
  status: { hostStarted?: boolean | null } | null | undefined,
): boolean {
  return Boolean(status?.hostStarted);
}

/** Only way to start a live-class backup poll. Always 5s+. Skips hidden tabs. */
export function startLiveClassBackupPoll(tick: () => void): () => void {
  const id = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    tick();
  }, LIVE_CLASS_POLL_MS);
  return () => clearInterval(id);
}
