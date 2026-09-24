import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformStaff } from "@/lib/api-auth";
import { hashAffiliatePassword } from "@/lib/affiliate/auth";
import { normalizeAffiliateCode } from "@/lib/affiliate/cookies";
import { DEFAULT_COMMISSION_RATE } from "@/lib/affiliate/commission";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  referralCode: z.string().min(3).max(24).optional(),
  commissionRate: z.number().min(0).max(0.5).optional(),
  status: z.enum(["PENDING", "ACTIVE", "PAUSED"]).optional(),
});

export async function GET() {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const affiliates = await prisma.affiliate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      referralCode: true,
      commissionRate: true,
      commissionMonths: true,
      vanityPath: true,
      status: true,
      stripeOnboarded: true,
      stripeAccountId: true,
      totalClicks: true,
      totalOrders: true,
      totalRevenueCents: true,
      totalCommissionCents: true,
      pendingBalanceCents: true,
      createdAt: true,
      _count: { select: { conversions: true, clicks: true, codes: true, payouts: true } },
    },
  });

  return NextResponse.json({
    affiliates: affiliates.map((row) => ({
      ...row,
      hasStripeAccount: Boolean(row.stripeAccountId),
      stripeAccountId: undefined,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Name, email, and a password of at least 8 characters are required." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.affiliate.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "An affiliate with this email already exists." }, { status: 400 });
  }

  let referralCode = normalizeAffiliateCode(parsed.data.referralCode);
  if (parsed.data.referralCode && (referralCode.length < 3 || referralCode.length > 16)) {
    return NextResponse.json({ error: "Referral code must be 3 to 16 letters or numbers." }, { status: 400 });
  }
  if (!referralCode) {
    const base = normalizeAffiliateCode(parsed.data.name.split(" ")[0] || "AFF").slice(0, 8) || "AFF";
    referralCode = `${base}20`;
  }
  const taken = await prisma.affiliate.findUnique({ where: { referralCode }, select: { id: true } });
  if (taken) return NextResponse.json({ error: "That referral code is already taken." }, { status: 400 });

  const created = await prisma.affiliate.create({
    data: {
      name: parsed.data.name.trim(),
      email,
      passwordHash: hashAffiliatePassword(parsed.data.password),
      referralCode,
      commissionRate: parsed.data.commissionRate ?? DEFAULT_COMMISSION_RATE,
      status: parsed.data.status ?? "ACTIVE",
    },
    select: { id: true, email: true, referralCode: true, status: true },
  });
  return NextResponse.json({ ok: true, affiliate: created });
}
