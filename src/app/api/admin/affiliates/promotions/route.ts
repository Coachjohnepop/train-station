import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformStaff } from "@/lib/api-auth";
import { ensurePromotionCoupon } from "@/lib/affiliate/promotions";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  const promotions = await prisma.affiliatePromotion.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ promotions });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  discountPercent: z.number().min(1).max(40),
  endsAt: z.string().datetime().optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Name and a discount from 1 to 40 are required." }, { status: 400 });
  }
  const created = await prisma.affiliatePromotion.create({
    data: {
      name: parsed.data.name,
      discountPercent: parsed.data.discountPercent,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    },
  });
  try {
    await ensurePromotionCoupon(created);
  } catch (error) {
    console.warn("[affiliate] promotion coupon failed", error);
  }
  return NextResponse.json({ ok: true, promotion: created });
}

const patchSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
});

export async function PATCH(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Missing promotion." }, { status: 400 });
  await prisma.affiliatePromotion.update({
    where: { id: parsed.data.id },
    data: { isActive: parsed.data.isActive },
  });
  return NextResponse.json({ ok: true });
}
