import { NextResponse } from "next/server";
import { z } from "zod";
import { applySessionCookies, getSessionUser } from "@/lib/auth";
import { claimGuestEmail } from "@/lib/byow-guest";
import { isGuestStubEmail } from "@/lib/byow-username";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!isGuestStubEmail(session.email)) {
    return NextResponse.json({ ok: true, email: session.email, already: true });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a real email." }, { status: 400 });
  }
  try {
    const claimed = await claimGuestEmail({
      userId: session.id,
      email: parsed.data.email,
    });
    const res = NextResponse.json({ ok: true, email: claimed.email });
    applySessionCookies(res, {
      id: session.id,
      email: claimed.email,
      name: session.name,
      role: session.role,
    });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save email.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
