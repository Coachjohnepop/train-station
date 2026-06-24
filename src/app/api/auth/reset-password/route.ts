import { NextResponse } from "next/server";
import { z } from "zod";
import { completePasswordReset } from "@/lib/password-reset";

const schema = z.object({
  token: z.string().min(16),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid reset link and a password with at least 8 characters." },
      { status: 400 },
    );
  }

  const result = await completePasswordReset(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json({ error: result.detail }, { status: 400 });
  }

  return NextResponse.json({ ok: true, redirectTo: "/login" });
}