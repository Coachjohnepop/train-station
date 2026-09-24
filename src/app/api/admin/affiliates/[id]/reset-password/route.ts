import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformStaff } from "@/lib/api-auth";
import { requestAffiliatePasswordReset } from "@/lib/affiliate/password-reset";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Params) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const affiliate = await prisma.affiliate.findUnique({
    where: { id },
    select: { email: true },
  });
  if (!affiliate) return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
  const result = await requestAffiliatePasswordReset(affiliate.email);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 503 });
  return NextResponse.json({ ok: true, message: result.message });
}
