import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAffiliate } from "@/lib/affiliate/auth";
import { createAffiliateDiscountCode } from "@/lib/affiliate/codes";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().min(3).max(24),
  discountPercent: z.union([z.literal(0.05), z.literal(0.1)]),
});

export async function POST(request: Request) {
  const affiliate = await getCurrentAffiliate();
  if (!affiliate) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (affiliate.status !== "ACTIVE") {
    return NextResponse.json({ error: "Codes open after the account is approved." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Use a code and a 5% or 10% discount." }, { status: 400 });
  }
  const created = await createAffiliateDiscountCode({
    affiliateId: affiliate.id,
    affiliateName: affiliate.name,
    rawCode: parsed.data.code,
    discountPercent: parsed.data.discountPercent,
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 400 });
  return NextResponse.json({ ok: true, code: created.code });
}
