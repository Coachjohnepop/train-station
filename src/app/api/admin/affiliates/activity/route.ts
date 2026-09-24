import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformStaff } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const [pending, conversions, payouts] = await Promise.all([
    prisma.affiliate.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, referralCode: true, createdAt: true },
    }),
    prisma.affiliateConversion.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        plan: true,
        orderSubtotalCents: true,
        commissionCents: true,
        commissionRate: true,
        status: true,
        createdAt: true,
        affiliate: { select: { name: true } },
      },
    }),
    prisma.affiliatePayout.findMany({
      where: { status: { not: "FAILED" } },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amountCents: true,
        status: true,
        stripeTransferId: true,
        createdAt: true,
        affiliate: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    pending,
    conversions: conversions.map((row) => ({
      id: row.id,
      affiliateName: row.affiliate.name,
      plan: row.plan,
      orderSubtotalCents: row.orderSubtotalCents,
      commissionCents: row.commissionCents,
      commissionRate: row.commissionRate,
      status: row.status,
      createdAt: row.createdAt,
    })),
    payouts: payouts.map((row) => ({
      id: row.id,
      affiliateName: row.affiliate.name,
      amountCents: row.amountCents,
      status: row.status,
      stripeTransferId: row.stripeTransferId,
      createdAt: row.createdAt,
    })),
  });
}
