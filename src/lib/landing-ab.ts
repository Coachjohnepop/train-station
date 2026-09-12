/**
 * Landing A/B/C — guests on `/` only.
 *
 * `tour` IS the current production landing. It stays in the stock forever.
 * If B/C fail, set LANDING_AB_ENABLED to false (or LIVE to ["tour"] only).
 * Preview URLs /l/jeremy and /l/floor still work so we can look without rotating traffic.
 *
 * Live split: A (tour) vs B (meet Jeremy). C (floor) is preview until A vs B has enough sessions.
 */

export const LANDING_AB_COOKIE = "ts_landing";
export const LANDING_AB_HEADER = "x-landing-variant";

export const LANDING_AB_VARIANTS = ["tour", "jeremy", "floor"] as const;
export type LandingAbVariant = (typeof LANDING_AB_VARIANTS)[number];

/** Current public homepage. Never delete this arm. */
export const LANDING_AB_CONTROL: LandingAbVariant = "tour";

/**
 * Flip to false to send every guest on `/` back to the current landing.
 * B and C stay in the stock at /l/jeremy and /l/floor.
 */
export const LANDING_AB_ENABLED = true;

/** Arms that cold traffic on `/` can be assigned. Always include `tour`. */
export const LANDING_AB_LIVE: readonly LandingAbVariant[] = ["tour", "jeremy"];

export const LANDING_AB_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export function parseLandingAbVariant(raw: string | null | undefined): LandingAbVariant | null {
  const v = (raw || "").trim().toLowerCase();
  if (v === "a" || v === "control" || v === "tour") return "tour";
  if (v === "b" || v === "meet" || v === "jeremy") return "jeremy";
  if (v === "c" || v === "floor") return "floor";
  return null;
}

export function assignLiveLandingAb(): LandingAbVariant {
  if (!LANDING_AB_ENABLED) return LANDING_AB_CONTROL;
  const live = LANDING_AB_LIVE.length ? LANDING_AB_LIVE : [LANDING_AB_CONTROL];
  const i = Math.floor(Math.random() * live.length);
  return live[i] ?? LANDING_AB_CONTROL;
}

/**
 * Sticky cookie, including preview C. New guests only get A/B via assignLiveLandingAb.
 * When the experiment is off, everyone on `/` is forced back to the current landing.
 */
export function resolveLiveLandingAb(existing: LandingAbVariant | null): LandingAbVariant {
  if (!LANDING_AB_ENABLED) return LANDING_AB_CONTROL;
  if (existing) return existing;
  return assignLiveLandingAb();
}

export function landingAbPath(variant: LandingAbVariant): string {
  return `/l/${variant}`;
}

export function landingAbCookiePair(variant: LandingAbVariant): string {
  return `${LANDING_AB_COOKIE}=${variant}; Path=/; Max-Age=${LANDING_AB_COOKIE_MAX_AGE}; SameSite=Lax`;
}
