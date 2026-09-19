/**
 * Landing A/B — guests on `/` only.
 *
 * `tour` IS the current production landing. It stays in the stock forever.
 * If a challenger fails, set LANDING_AB_ENABLED to false (or LIVE to ["tour"] only).
 * Preview URLs /l/jeremy, /l/floor, /l/class still work without rotating traffic.
 *
 * Live split (this pass): A (tour / tickets) vs B (get started — How it Works + Try it now).
 * 6:30am class and floor stay preview at /l/class and /l/floor.
 */

export const LANDING_AB_COOKIE = "ts_landing";
export const LANDING_AB_HEADER = "x-landing-variant";

export const LANDING_AB_VARIANTS = ["tour", "jeremy", "floor", "class"] as const;
export type LandingAbVariant = (typeof LANDING_AB_VARIANTS)[number];

/** Current public homepage. Never delete this arm. */
export const LANDING_AB_CONTROL: LandingAbVariant = "tour";

/**
 * Flip to false to send every guest on `/` back to the current landing.
 * Other arms stay in the stock at /l/jeremy, /l/floor, /l/class.
 */
export const LANDING_AB_ENABLED = true;

/** Arms that cold traffic on `/` can be assigned. Always include `tour`. */
export const LANDING_AB_LIVE: readonly LandingAbVariant[] = ["tour", "jeremy"];

export type LandingAbArmStatus = "live" | "retired" | "preview";

export const LANDING_AB_META: Record<
  LandingAbVariant,
  { letter: string; name: string; status: LandingAbArmStatus }
> = {
  tour: { letter: "A", name: "Tour (homepage)", status: "live" },
  jeremy: { letter: "B", name: "Get started · real app walk", status: "live" },
  floor: { letter: "C", name: "Floor", status: "preview" },
  class: { letter: "D", name: "6:30am Zoom class", status: "preview" },
};

/** What this live split is trying to learn. Shown on Station pulse. */
export const LANDING_AB_TEST = {
  title: "A · sell the ticket  vs  B · show the console",
  mission:
    "Find the first ask that gets a stranger using the Train Station — not just watching a video.",
  goal: "More people start Today (Free / Train Station Style or a paid seat) without bouncing on a ticket pick.",
  a: "A (control): tickets first. Start membership is the main tap. How it Works is the caricature tour.",
  b: "B (challenger): teach the real Today / log-set / rest walk, ask if they’d bring their own workout later, then Train Station Style. No BYOW signup yet.",
} as const;

/** Old live D — keep /l/class sticky; do not assign it on `/`. */
export const LANDING_AB_RETIRED_LIVE: readonly LandingAbVariant[] = [];

export const LANDING_AB_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export function parseLandingAbVariant(raw: string | null | undefined): LandingAbVariant | null {
  const v = (raw || "").trim().toLowerCase();
  if (v === "a" || v === "control" || v === "tour") return "tour";
  if (v === "b" || v === "meet" || v === "jeremy") return "jeremy";
  if (v === "c" || v === "floor") return "floor";
  if (v === "d" || v === "class" || v === "zoom" || v === "aboard" || v === "630") return "class";
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
  if (existing && (LANDING_AB_RETIRED_LIVE as readonly string[]).includes(existing)) {
    return assignLiveLandingAb();
  }
  if (existing) return existing;
  return assignLiveLandingAb();
}

export function landingAbPath(variant: LandingAbVariant): string {
  return `/l/${variant}`;
}

export function landingAbCookiePair(variant: LandingAbVariant): string {
  return `${LANDING_AB_COOKIE}=${variant}; Path=/; Max-Age=${LANDING_AB_COOKIE_MAX_AGE}; SameSite=Lax`;
}
