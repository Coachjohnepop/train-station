/** Public offer for Jeremy’s weekday morning Zoom. Used by landing A/B `class`. */

export const LIVE_CLASS_OFFER = {
  timeLabel: "6:30am",
  timeZoneLabel: "Pacific",
  days: ["Tue", "Wed", "Fri"] as const,
  daysLabel: "Tue · Wed · Fri",
  /** Coach Class — live Zoom is on that ticket. */
  signupHref: "/signup?plan=member",
} as const;
