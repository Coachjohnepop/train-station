import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyAffiliateSessionCookie,
  authenticateAffiliate,
  clearAffiliateSessionCookie,
} from "@/lib/affiliate/auth";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the email and password for this affiliate account." }, { status: 400 });
  }
  const affiliate = await authenticateAffiliate(parsed.data.email, parsed.data.password);
  if (!affiliate) {
    return NextResponse.json({ error: "That email or password does not match." }, { status: 401 });
  }
  const res = NextResponse.json({
    ok: true,
    name: affiliate.name,
    status: affiliate.status,
  });
  applyAffiliateSessionCookie(res, affiliate);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearAffiliateSessionCookie(res);
  return res;
}
