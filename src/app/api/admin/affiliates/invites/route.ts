import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformStaff } from "@/lib/api-auth";
import { canSendAffiliateInvite, sendAffiliateInvite } from "@/lib/affiliate/invites";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
});

export async function POST(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  if (!canSendAffiliateInvite(auth.session.email)) {
    return NextResponse.json({ error: "Only John and Jeremy can send affiliate invites." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }
  const result = await sendAffiliateInvite({
    name: parsed.data.name,
    email: parsed.data.email,
    invitedByEmail: auth.session.email,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({
    ok: true,
    link: result.link,
    emailed: result.emailed,
    message: result.emailed
      ? "Invite emailed. You can also copy the link."
      : "Email did not send. Copy the link and send it yourself.",
  });
}
