import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/api-auth";
import { processAffiliatePayout } from "@/lib/affiliate/payouts";

export const dynamic = "force-dynamic";

/** Staff review on the same /affiliate address. Not linked from the rest of the app. */
export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const [pending, payouts] = await Promise.all([
    prisma.affiliate.findMany({
      where: { status: { in: ["PENDING", "ACTIVE", "PAUSED"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        email: true,
        referralCode: true,
        status: true,
        pendingBalanceCents: true,
        totalOrders: true,
        stripeOnboarded: true,
        createdAt: true,
      },
    }),
    prisma.affiliatePayout.findMany({
      where: { status: "REQUESTED" },
      orderBy: { createdAt: "asc" },
      include: { affiliate: { select: { name: true, email: true, referralCode: true } } },
    }),
  ]);

  return NextResponse.json({ affiliates: pending, payouts });
}

const actionSchema = z.object({
  action: z.enum(["approve", "pause", "terminate", "mark-paid", "pay", "decline-payout"]),
  affiliateId: z.string().min(1).optional(),
  payoutId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const parsed = actionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const { action, affiliateId, payoutId } = parsed.data;

  if (action === "approve" || action === "pause" || action === "terminate") {
    if (!affiliateId) return NextResponse.json({ error: "Missing affiliate." }, { status: 400 });
    const status = action === "approve" ? "ACTIVE" : action === "pause" ? "PAUSED" : "TERMINATED";
    await prisma.affiliate.update({ where: { id: affiliateId }, data: { status } });
    return NextResponse.json({ ok: true, status });
  }

  if (action === "mark-paid" || action === "pay") {
    let targetId = affiliateId;
    if (!targetId && payoutId) {
      const payout = await prisma.affiliatePayout.findUnique({ where: { id: payoutId } });
      targetId = payout?.affiliateId;
    }
    if (!targetId) return NextResponse.json({ error: "Missing affiliate." }, { status: 400 });
    const paid = await processAffiliatePayout(targetId, { ignoreMinimum: true });
    if (!paid.ok) return NextResponse.json({ error: paid.error }, { status: 400 });
    return NextResponse.json({ ok: true, transferId: paid.transferId, amountCents: paid.amountCents });
  }

  if (!payoutId) return NextResponse.json({ error: "Missing payout." }, { status: 400 });
  const payout = await prisma.affiliatePayout.findUnique({ where: { id: payoutId } });
  if (!payout || payout.status === "COMPLETED") {
    return NextResponse.json({ error: "That payout is not waiting." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.affiliatePayout.update({
      where: { id: payout.id },
      data: { status: "FAILED", processedAt: new Date(), note: "Declined from the affiliate desk" },
    });
    await tx.affiliateConversion.updateMany({
      where: { payoutId: payout.id, status: { in: ["PENDING", "APPROVED"] } },
      data: { payoutId: null },
    });
    const remaining = await tx.affiliateConversion.aggregate({
      where: {
        affiliateId: payout.affiliateId,
        status: { in: ["PENDING", "APPROVED"] },
        payoutId: null,
      },
      _sum: { commissionCents: true },
    });
    await tx.affiliate.update({
      where: { id: payout.affiliateId },
      data: { pendingBalanceCents: remaining._sum.commissionCents ?? 0 },
    });
  });
  return NextResponse.json({ ok: true });
}
