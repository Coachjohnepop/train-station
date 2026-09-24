import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformStaff } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** Twelve months of program revenue and the top affiliates. */
export async function GET() {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const now = new Date();
  const twelveMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const conversions = await prisma.affiliateConversion.findMany({
    where: { createdAt: { gte: twelveMonthsAgo }, status: { not: "CANCELLED" } },
    select: { orderSubtotalCents: true, commissionCents: true, createdAt: true },
  });

  const monthMap = new Map<string, { month: string; revenueCents: number; commissionCents: number; orders: number }>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, { month: key, revenueCents: 0, commissionCents: 0, orders: 0 });
  }
  for (const row of conversions) {
    const key = row.createdAt.toISOString().slice(0, 7);
    const bucket = monthMap.get(key);
    if (!bucket) continue;
    bucket.revenueCents += row.orderSubtotalCents;
    bucket.commissionCents += row.commissionCents;
    bucket.orders += 1;
  }

  const top = await prisma.affiliate.findMany({
    where: { status: "ACTIVE" },
    orderBy: { totalRevenueCents: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      totalOrders: true,
      totalClicks: true,
      totalRevenueCents: true,
      conversions: {
        where: { status: { not: "CANCELLED" } },
        select: { commissionCents: true },
      },
    },
  });

  const [all, totals] = await Promise.all([
    prisma.affiliateConversion.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { commissionCents: true },
    }),
    prisma.affiliate.aggregate({
      _sum: { totalRevenueCents: true, pendingBalanceCents: true },
      _count: true,
    }),
  ]);
  const totalRevenueCents = totals._sum.totalRevenueCents ?? 0;
  const totalCommissionCents = all.reduce((sum, row) => sum + row.commissionCents, 0);
  const orders = all.length;

  return NextResponse.json({
    months: [...monthMap.values()],
    topAffiliates: top.map((row) => ({
      id: row.id,
      name: row.name,
      revenueCents: row.totalRevenueCents,
      commissionCents: row.conversions.reduce((sum, item) => sum + item.commissionCents, 0),
      orders: row.totalOrders,
      conversionRate: row.totalClicks > 0 ? (row.totalOrders / row.totalClicks) * 100 : 0,
    })),
    programSummary: {
      totalRevenueCents,
      totalCommissionCents,
      pendingBalanceCents: totals._sum.pendingBalanceCents ?? 0,
      totalAffiliates: totals._count,
      orders,
      avgOrderCents: orders > 0 ? Math.round(totalRevenueCents / orders) : 0,
      avgCommissionCents: orders > 0 ? Math.round(totalCommissionCents / orders) : 0,
    },
  });
}
