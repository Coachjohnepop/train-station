/**
 * Shared rest popup: when a remote live-session snapshot may open, close, or
 * be ignored. Rest must never start just because completedSets changed.
 */

export type RemoteRestSnapshot = {
  endsAt: number;
  blockId: string;
  completedSetNum: number;
} | null | undefined;

/** Partner sent an explicit clear (skip / natural end). */
export function remoteRestIsClear(rest: RemoteRestSnapshot): rest is null {
  return rest === null;
}

/**
 * True when this restActive must not open the popup:
 * expired, inside the skip suppress window, or the same window we just closed.
 */
export function remoteRestShouldIgnore(input: {
  rest: { endsAt: number };
  now: number;
  suppressUntil: number;
  ignoredEndsAt: number;
}): boolean {
  if (input.rest.endsAt <= input.now + 250) return true;
  if (input.now < input.suppressUntil) return true;
  if (input.ignoredEndsAt > 0 && input.rest.endsAt === input.ignoredEndsAt) return true;
  return false;
}

/**
 * Older clients used a completedSets diff to spin rest when restActive was
 * missing. That fired on hydrate, HIT checkoffs, and uncheck/re-merge races.
 * Rest is restActive-only on the remote path.
 */
export function shouldStartRestFromRemoteSetDiff(_input: {
  restActivePresent: boolean;
}): boolean {
  return false;
}
