/**
 * Train Station × Eco Delight sponsorship / affiliate config.
 * Commission is tracked on Eco Delight; we surface totals via sponsor-stats API.
 */

export const ECO_DELIGHT_STORE_URL =
  process.env.ECO_DELIGHT_STORE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_ECO_DELIGHT_STORE_URL?.replace(/\/$/, "") ||
  "https://buyecodelight.com";

export const ECO_DELIGHT_REFERRAL_CODE =
  process.env.ECO_DELIGHT_REFERRAL_CODE?.trim().toUpperCase() || "TRAINSTATION";

export const ECO_DELIGHT_DISCOUNT_CODE =
  process.env.ECO_DELIGHT_DISCOUNT_CODE?.trim().toUpperCase() || "JEREMYDISC";

/** 10% off for members via JEREMYDISC */
export const ECO_DELIGHT_DISCOUNT_PERCENT = 10;

export function ecoDelightBuySubscriptionsUrl(): string {
  const u = new URL(`${ECO_DELIGHT_STORE_URL}/store/subscriptions`);
  u.searchParams.set("ref", ECO_DELIGHT_REFERRAL_CODE);
  u.searchParams.set("discount", ECO_DELIGHT_DISCOUNT_CODE);
  u.searchParams.set("from", "train-station");
  u.searchParams.set("jeremy", "1");
  return u.toString();
}

export function ecoDelightBuyStoreUrl(): string {
  const u = new URL(`${ECO_DELIGHT_STORE_URL}/store`);
  u.searchParams.set("ref", ECO_DELIGHT_REFERRAL_CODE);
  return u.toString();
}

export type EcoDelightSponsorStats = {
  ok: boolean;
  partner?: {
    name: string;
    email: string;
    referralCode: string;
    status: string;
    stripeOnboarded: boolean;
  };
  discount?: {
    code: string;
    percent: number;
    maxUsage: number | null;
    usageCount: number;
    expiresAt: string | null;
  };
  stats?: {
    totalClicks: number;
    totalOrders: number;
    totalRevenue: number;
    totalCommission: number;
    pendingBalance: number;
    commissionRate: number;
  };
  links?: {
    buySubscriptions: string;
    buyStore: string;
    affiliatePortal: string;
  };
  recent?: Array<{
    commission: number;
    subtotal: number;
    status: string;
    at: string;
  }>;
  error?: string;
};

export async function fetchEcoDelightSponsorStats(): Promise<EcoDelightSponsorStats> {
  const secret = process.env.ECO_DELIGHT_AFFILIATE_STATS_SECRET?.trim() || "";
  // Prefer explicit API host; fall back to store URL then known Eco Vercel prod.
  const bases = [
    process.env.ECO_DELIGHT_API_URL?.replace(/\/$/, ""),
    ECO_DELIGHT_STORE_URL,
    "https://eco-coffee-eight.vercel.app",
  ].filter(Boolean) as string[];

  let lastError = "fetch failed";
  for (const base of bases) {
    const url = new URL(`${base}/api/affiliate/sponsor-stats`);
    url.searchParams.set("ref", ECO_DELIGHT_REFERRAL_CODE);
    if (secret) url.searchParams.set("secret", secret);
    try {
      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      });
      const body = (await res.json().catch(() => ({}))) as EcoDelightSponsorStats;
      if (!res.ok) {
        lastError = body.error || `status ${res.status} @ ${base}`;
        continue;
      }
      return { ...body, ok: true };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "fetch failed";
    }
  }
  return { ok: false, error: lastError };
}
