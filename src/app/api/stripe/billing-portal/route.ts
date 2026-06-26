import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { createBillingPortalSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const profile = await getMemberProfile(session.id);
  if (!profile?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe billing profile on this account yet." },
      { status: 404 },
    );
  }

  const portal = await createBillingPortalSession({
    customerId: profile.stripeCustomerId,
    returnPath: "/member/account",
  });

  if ("error" in portal) {
    return NextResponse.json({ error: portal.error }, { status: 503 });
  }

  return NextResponse.json({ ok: true, url: portal.url });
}