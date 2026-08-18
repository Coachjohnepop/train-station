/** Backup poll while coach has started live class. Idle pages do not interval. */
export const LIVE_CLASS_POLL_MS = 5_000;

export function isLiveClassSessionGoing(
  status: { hostStarted?: boolean | null } | null | undefined,
): boolean {
  return Boolean(status?.hostStarted);
}
