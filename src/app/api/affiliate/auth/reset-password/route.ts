import { NextResponse } from "next/server";
import { z } from "zod";
import { resetAffiliatePassword } from "@/lib/affiliate/password-reset";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "That reset link or password is not valid." }, { status: 400 });
  }
  const result = await resetAffiliatePassword(parsed.data.token, parsed.data.password);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json({ ok: true, message: result.message });
}
