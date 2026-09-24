import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformStaff } from "@/lib/api-auth";
import { processAffiliatePayout } from "@/lib/affiliate/payouts";

export const dynamic = "force-dynamic";

/** Pay every active, Stripe-connected affiliate who has unpaid commission. */
export async function POST() {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const eligible = await prisma.affiliate.findMany({
    where: {
      status: "ACTIVE",
      stripeOnboarded: true,
      conversions: { some: { status: { in: ["APPROVED", "PENDING"] }, payoutId: null } },
    },
    select: { id: true, name: true },
  });

  const results: { name: string; ok: boolean; amountCents?: number; error?: string }[] = [];
  for (const row of eligible) {
    const paid = await processAffiliatePayout(row.id, { ignoreMinimum: true });
    results.push(
      paid.ok
        ? { name: row.name, ok: true, amountCents: paid.amountCents }
        : { name: row.name, ok: false, error: paid.error },
    );
  }
  const paidCents = results.reduce((sum, row) => sum + (row.amountCents || 0), 0);
  return NextResponse.json({
    count: results.length,
    succeeded: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
    paidCents,
    results,
  });
}
