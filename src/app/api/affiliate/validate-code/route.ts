import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeAffiliateCode } from "@/lib/affiliate/cookies";
import { commissionCents } from "@/lib/affiliate/commission";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().min(1).max(32),
  subtotalCents: z.number().int().positive().optional(),
});

/** Checkout check for an affiliate referral or discount code. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter a code." }, { status: 400 });
  const code = normalizeAffiliateCode(parsed.data.code);
  if (!code) return NextResponse.json({ error: "Enter a code." }, { status: 400 });

  const discount = await prisma.affiliateCode.findUnique({
    where: { code },
    include: { affiliate: true },
  });
  if (discount) {
    if (!discount.isActive || discount.affiliate.status !== "ACTIVE") {
      return NextResponse.json({ error: "This code is no longer active." }, { status: 400 });
    }
    if (discount.expiresAt && discount.expiresAt < new Date()) {
      return NextResponse.json({ error: "This code has expired." }, { status: 400 });
    }
    if (discount.maxUsage != null && discount.usageCount >= discount.maxUsage) {
      return NextResponse.json({ error: "This code has been used up." }, { status: 400 });
    }
    const subtotal = parsed.data.subtotalCents ?? 0;
    return NextResponse.json({
      ok: true,
      kind: "discount",
      code: discount.code,
      affiliateName: discount.affiliate.name,
      discountPercent: discount.discountPercent,
      commissionRate: discount.commissionRate,
      discountCents: subtotal ? Math.round(subtotal * discount.discountPercent) : null,
      commissionCents: subtotal ? commissionCents(subtotal, discount.commissionRate) : null,
    });
  }

  const affiliate = await prisma.affiliate.findUnique({ where: { referralCode: code } });
  if (!affiliate || affiliate.status !== "ACTIVE") {
    return NextResponse.json({ error: "That code is not active." }, { status: 400 });
  }
  const subtotal = parsed.data.subtotalCents ?? 0;
  const rate = affiliate.commissionRate;
  return NextResponse.json({
    ok: true,
    kind: "referral",
    code: affiliate.referralCode,
    affiliateName: affiliate.name,
    discountPercent: 0,
    commissionRate: rate,
    discountCents: 0,
    commissionCents: subtotal ? commissionCents(subtotal, rate) : null,
  });
}
