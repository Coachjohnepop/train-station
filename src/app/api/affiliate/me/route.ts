import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAffiliate, hashAffiliatePassword } from "@/lib/affiliate/auth";
import { verifyPassword } from "@/lib/password";
import { appBaseUrl } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function GET() {
  const affiliate = await getCurrentAffiliate();
  if (!affiliate) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const [conversions, codes, payouts] = await Promise.all([
    prisma.affiliateConversion.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        plan: true,
        orderSubtotalCents: true,
        commissionCents: true,
        commissionRate: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.affiliateCode.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        discountPercent: true,
        commissionRate: true,
        usageCount: true,
        isActive: true,
      },
    }),
    prisma.affiliatePayout.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, amountCents: true, status: true, createdAt: true, processedAt: true },
    }),
  ]);

  const origin = appBaseUrl().replace(/\/$/, "");
  return NextResponse.json({
    id: affiliate.id,
    name: affiliate.name,
    email: affiliate.email,
    referralCode: affiliate.referralCode,
    commissionRate: affiliate.commissionRate,
    status: affiliate.status,
    totalClicks: affiliate.totalClicks,
    totalOrders: affiliate.totalOrders,
    totalRevenueCents: affiliate.totalRevenueCents,
    totalCommissionCents: affiliate.totalCommissionCents,
    pendingBalanceCents: affiliate.pendingBalanceCents,
    stripeOnboarded: affiliate.stripeOnboarded,
    hasStripeAccount: Boolean(affiliate.stripeAccountId),
    joinUrl: `${origin}/join?ref=${encodeURIComponent(affiliate.referralCode)}`,
    conversions,
    codes,
    payouts,
  });
}

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(200).optional(),
});

export async function PATCH(request: Request) {
  const affiliate = await getCurrentAffiliate();
  if (!affiliate) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Check the name or password." }, { status: 400 });

  const data: { name?: string; passwordHash?: string } = {};
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.newPassword) {
    if (!parsed.data.currentPassword || !verifyPassword(parsed.data.currentPassword, affiliate.passwordHash)) {
      return NextResponse.json({ error: "Current password does not match." }, { status: 400 });
    }
    data.passwordHash = hashAffiliatePassword(parsed.data.newPassword);
  }
  if (!data.name && !data.passwordHash) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  await prisma.affiliate.update({ where: { id: affiliate.id }, data });
  return NextResponse.json({ ok: true });
}
