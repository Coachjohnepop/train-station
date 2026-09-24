import { NextResponse } from "next/server";
import { z } from "zod";
import { requestAffiliatePasswordReset } from "@/lib/affiliate/password-reset";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the email on the affiliate account." }, { status: 400 });
  }
  const result = await requestAffiliatePasswordReset(parsed.data.email);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 503 });
  return NextResponse.json({ ok: true, message: result.message });
}
