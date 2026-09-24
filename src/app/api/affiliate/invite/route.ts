import { NextResponse } from "next/server";
import { readAffiliateInvite } from "@/lib/affiliate/invites";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const invite = await readAffiliateInvite(token);
  if (!invite.ok) return NextResponse.json({ error: invite.error }, { status: 400 });
  return NextResponse.json({ ok: true, name: invite.name, email: invite.email });
}
