import { NextResponse } from "next/server";
import { getCurrentAffiliate } from "@/lib/affiliate/auth";
import { affiliateStripeStatus, createAffiliateConnectLink } from "@/lib/affiliate/payouts";

export const dynamic = "force-dynamic";

export async function GET() {
  const affiliate = await getCurrentAffiliate();
  if (!affiliate) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const status = await affiliateStripeStatus(affiliate.id);
  return NextResponse.json({
    hasAccount: status.hasAccount,
    stripeOnboarded: status.stripeOnboarded,
  });
}

export async function POST() {
  const affiliate = await getCurrentAffiliate();
  if (!affiliate) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const link = await createAffiliateConnectLink(affiliate.id);
  if ("error" in link) return NextResponse.json({ error: link.error }, { status: 400 });
  return NextResponse.json({
    url: link.url,
    onboarded: link.onboarded,
  });
}
