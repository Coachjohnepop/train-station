import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformStaff } from "@/lib/api-auth";
import { createBillingRefund, listBillingRefunds } from "@/lib/stripe-billing-admin";

export const dynamic = "force-dynamic";

const refundSchema = z.object({
  chargeId: z.string().min(3).max(80),
  /** Omit or null for full remaining balance; cents for partial. */
  amountCents: z.number().int().positive().nullable().optional(),
  reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).nullable().optional(),
  note: z.string().max(400).nullable().optional(),
});

export async function GET(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const limit = Number(new URL(request.url).searchParams.get("limit") || "50");
  try {
    const result = await listBillingRefunds(Number.isFinite(limit) ? limit : 50);
    if (result.error) {
      return NextResponse.json({ error: result.error, refunds: [] }, { status: 503 });
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load refunds.";
    console.error("[admin/billing/refunds GET]", message);
    return NextResponse.json({ error: message, refunds: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const parsed = refundSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid refund request.", detail: parsed.error.flatten() }, { status: 400 });
  }

  const result = await createBillingRefund({
    chargeId: parsed.data.chargeId,
    amountCents: parsed.data.amountCents,
    reason: parsed.data.reason ?? "requested_by_customer",
    note: parsed.data.note,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, refund: result.refund });
}
