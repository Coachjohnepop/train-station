import { NextResponse } from "next/server";
import { z } from "zod";
import { applySessionCookies, getSessionUser } from "@/lib/auth";
import { claimByowUsername } from "@/lib/byow-guest";
import { isPlaceholderGuestUsername } from "@/lib/byow-username";

export const dynamic = "force-dynamic";

const schema = z.object({
  username: z.string().min(3).max(24),
});

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!isPlaceholderGuestUsername(session.name)) {
    return NextResponse.json({ ok: true, username: session.name, already: true });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a username." }, { status: 400 });
  }
  try {
    const claimed = await claimByowUsername({
      userId: session.id,
      username: parsed.data.username,
    });
    const res = NextResponse.json({ ok: true, username: claimed.username });
    applySessionCookies(res, {
      id: session.id,
      email: session.email,
      name: claimed.username,
      role: session.role,
    });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
