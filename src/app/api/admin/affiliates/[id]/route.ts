import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformStaff } from "@/lib/api-auth";
import { hashAffiliatePassword } from "@/lib/affiliate/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const affiliate = await prisma.affiliate.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      referralCode: true,
      commissionRate: true,
      status: true,
      stripeOnboarded: true,
      stripeAccountId: true,
      totalClicks: true,
      totalOrders: true,
      totalRevenueCents: true,
      totalCommissionCents: true,
      pendingBalanceCents: true,
      createdAt: true,
      codes: {
        select: { id: true, code: true, discountPercent: true, commissionRate: true, usageCount: true, isActive: true },
      },
      conversions: {
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          userId: true,
          plan: true,
          orderSubtotalCents: true,
          commissionCents: true,
          status: true,
          createdAt: true,
        },
      },
      payouts: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          amountCents: true,
          status: true,
          stripeTransferId: true,
          createdAt: true,
          processedAt: true,
          note: true,
        },
      },
    },
  });
  if (!affiliate) return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
  return NextResponse.json({
    ...affiliate,
    hasStripeAccount: Boolean(affiliate.stripeAccountId),
    stripeAccountId: undefined,
  });
}

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  commissionRate: z.number().min(0).max(0.5).optional(),
  status: z.enum(["PENDING", "ACTIVE", "PAUSED", "TERMINATED"]).optional(),
  password: z.string().min(8).max(200).optional(),
});

export async function PATCH(request: Request, context: Params) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Check the affiliate fields." }, { status: 400 });

  const data: {
    name?: string;
    commissionRate?: number;
    status?: string;
    passwordHash?: string;
  } = {};
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.commissionRate != null) data.commissionRate = parsed.data.commissionRate;
  if (parsed.data.status) data.status = parsed.data.status;
  if (parsed.data.password) data.passwordHash = hashAffiliatePassword(parsed.data.password);
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  try {
    await prisma.affiliate.update({ where: { id }, data });
  } catch {
    return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: Params) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    await prisma.affiliate.update({ where: { id }, data: { status: "TERMINATED" } });
  } catch {
    return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, status: "TERMINATED" });
}
