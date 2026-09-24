import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAffiliate } from "@/lib/affiliate/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const affiliate = await getCurrentAffiliate();
  if (!affiliate) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 5);
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);

  const [conversions, clicks] = await Promise.all([
    prisma.affiliateConversion.findMany({
      where: { affiliateId: affiliate.id, createdAt: { gte: since }, status: { not: "CANCELLED" } },
      select: { createdAt: true, orderSubtotalCents: true, commissionCents: true },
    }),
    prisma.affiliateClick.findMany({
      where: { affiliateId: affiliate.id, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const buckets = new Map<string, { month: string; revenueCents: number; commissionCents: number; orders: number; clicks: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { month: key, revenueCents: 0, commissionCents: 0, orders: 0, clicks: 0 });
  }
  for (const row of conversions) {
    const key = row.createdAt.toISOString().slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.revenueCents += row.orderSubtotalCents;
    bucket.commissionCents += row.commissionCents;
  }
  for (const row of clicks) {
    const bucket = buckets.get(row.createdAt.toISOString().slice(0, 7));
    if (bucket) bucket.clicks += 1;
  }

  return NextResponse.json({ months: [...buckets.values()] });
}
