import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  buildCheckoutReceiptForUser,
  latestReceiptSessionIdForUser,
} from "@/lib/stripe-checkout-receipt";

export const dynamic = "force-dynamic";

/**
 * Member payment confirmation / receipt.
 * GET ?sessionId=cs_…  — specific checkout
 * GET (no id)          — latest session on profile
 */
export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const url = new URL(request.url);
  let sessionId = url.searchParams.get("sessionId")?.trim() || "";
  if (!sessionId) {
    sessionId = (await latestReceiptSessionIdForUser(session.id)) || "";
  }
  if (!sessionId) {
    return NextResponse.json(
      { error: "No payment confirmation on file yet." },
      { status: 404 },
    );
  }

  const receipt = await buildCheckoutReceiptForUser(session.id, sessionId);
  if ("error" in receipt) {
    return NextResponse.json({ error: receipt.error }, { status: receipt.status });
  }

  return NextResponse.json(
    { ok: true, receipt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
