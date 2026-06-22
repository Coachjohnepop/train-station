import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { createPartnerDashboardLink } from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

const schema = z.object({
  partnerId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "partnerId is required." }, { status: 400 });
  }

  const link = await createPartnerDashboardLink(parsed.data.partnerId);
  if ("error" in link) {
    return NextResponse.json({ error: link.error }, { status: 503 });
  }

  return NextResponse.json({ ok: true, url: link.url });
}