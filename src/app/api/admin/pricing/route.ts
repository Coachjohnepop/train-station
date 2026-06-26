import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  getAdminPricingSnapshot,
  importStripePriceIdsFromEnv,
  syncStripePriceForPlan,
} from "@/lib/pricing-catalog";
import { upsertPricingPlanRecord } from "@/lib/pricing-catalog-store";
import type { MembershipPlan } from "@/lib/signup-plans";

export const dynamic = "force-dynamic";

const PAID: MembershipPlan[] = ["member", "business", "pro"];

const patchSchema = z.object({
  planId: z.enum(["member", "business", "pro"]),
  label: z.string().min(1).max(80).optional(),
  priceDollars: z.number().min(0).optional(),
  stripePriceId: z.string().max(120).nullable().optional(),
  stripeProductId: z.string().max(120).nullable().optional(),
  enabled: z.boolean().optional(),
  syncStripe: z.boolean().optional(),
});

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await importStripePriceIdsFromEnv();
  const snapshot = await getAdminPricingSnapshot();
  return NextResponse.json(snapshot);
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid pricing data." }, { status: 400 });
  }

  const { planId, priceDollars, syncStripe, ...rest } = parsed.data;
  if (!PAID.includes(planId)) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  const priceCents =
    priceDollars !== undefined ? Math.round(priceDollars * 100) : undefined;

  if (syncStripe && priceCents !== undefined) {
    const synced = await syncStripePriceForPlan({
      planId,
      priceCents,
      label: rest.label,
    });
    if ("error" in synced) {
      return NextResponse.json({ error: synced.error }, { status: 503 });
    }
    const snapshot = await getAdminPricingSnapshot();
    return NextResponse.json({
      ok: true,
      synced,
      snapshot,
      message: "New Stripe price created and saved. Landing + checkout updated.",
    });
  }

  await upsertPricingPlanRecord(planId, {
    ...rest,
    ...(priceCents !== undefined ? { priceCents } : {}),
  });

  const snapshot = await getAdminPricingSnapshot();
  return NextResponse.json({ ok: true, snapshot });
}