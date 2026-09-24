/** Cookie names shared by middleware and the affiliate API. No database imports. */

export const AFFILIATE_SESSION_COOKIE = "ts_affiliate";
export const AFFILIATE_REF_COOKIE = "ts_affiliate_ref";
export const AFFILIATE_VISITOR_COOKIE = "ts_affiliate_visitor";

/** First-click attribution window. */
export const AFFILIATE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export function generateAffiliateVisitorId(): string {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function normalizeAffiliateCode(raw: string | null | undefined): string {
  return (raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
