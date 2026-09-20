/** Marker our Playwright / node loops stamp on the UA so analytics can drop them. */
export const LOOP_UA_TOKEN = "TrainStationLoop";

/** Exact iPhone UA `scripts/landing-ab-loop.mjs` used before the token existed. */
export const LEGACY_LOOP_IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const LOOP_UA_RE = /TrainStationLoop|HeadlessChrome|Playwright/i;

export function isLoopUserAgent(userAgent?: string | null): boolean {
  const ua = (userAgent || "").trim();
  if (!ua) return false;
  if (LOOP_UA_RE.test(ua)) return true;
  return ua === LEGACY_LOOP_IPHONE_UA;
}

export function withLoopUserAgent(base: string): string {
  if (base.includes(LOOP_UA_TOKEN)) return base;
  return `${base} ${LOOP_UA_TOKEN}/1`.slice(0, 500);
}
