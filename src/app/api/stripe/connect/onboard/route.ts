import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { createPartnerOnboardingLink } from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  const link = await createPartnerOnboardingLink();
  if ("error" in link) {
    return NextResponse.json({ error: link.error }, { status: 503 });
  }

  return NextResponse.json({ ok: true, url: link.url });
}