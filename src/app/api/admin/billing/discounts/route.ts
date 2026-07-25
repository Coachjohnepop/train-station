import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { actorFromSession, auditFromRequest } from "@/lib/audit-request";
import {
  createBillingDiscount,
  listBillingCouponsAndPromos,
  setPromotionCodeActive,
} from "@/lib/stripe-billing-admin";
import { createReferralCode } from "@/lib/referral-codes-store";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().max(80).optional().nullable(),
  percentOff: z.number().min(0.01).max(100).optional().nullable(),
  amountOffCents: z.number().int().positive().optional().nullable(),
  currency: z.string().length(3).optional(),
  duration: z.enum(["once", "repeating", "forever"]).default("repeating"),
  durationInMonths: z.number().int().min(1).max(36).optional().nullable(),
  maxRedemptions: z.number().int().positive().optional().nullable(),
  expiresAtIso: z.string().optional().nullable(),
  /** Restrict to recurring memberships, one-time packages, or all. */
  appliesTo: z.enum(["subscription", "one_time", "all"]).default("subscription"),
  /** Also save into app referral map for ?ref= / signup checkout */
  saveAsAppReferral: z.boolean().optional(),
  notes: z.string().max(500).optional().nullable(),
});

const patchSchema = z.object({
  promotionCodeId: z.string().min(3),
  active: z.boolean(),
});

export async function GET() {
  // Coaches create promo codes from Coach → Discounts; platform still uses Billing tab.
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  try {
    const result = await listBillingCouponsAndPromos();
    if (result.error) {
      return NextResponse.json(
        { error: result.error, coupons: [], promotionCodes: [] },
        { status: 503 },
      );
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load discounts.";
    console.error("[admin/billing/discounts GET]", message);
    return NextResponse.json({ error: message, coupons: [], promotionCodes: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid discount data.", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const created = await createBillingDiscount({
    code: parsed.data.code,
    name: parsed.data.name,
    percentOff: parsed.data.percentOff,
    amountOffCents: parsed.data.amountOffCents,
    currency: parsed.data.currency,
    duration: parsed.data.duration,
    durationInMonths: parsed.data.durationInMonths,
    maxRedemptions: parsed.data.maxRedemptions,
    expiresAtIso: parsed.data.expiresAtIso,
    appliesTo: parsed.data.appliesTo,
    createPromotionCode: true,
  });

  if (!created.ok) {
    await auditFromRequest(request, {
      action: "billing.discount.create",
      outcome: "failure",
      actor: actorFromSession(auth.session),
      metadata: { error: created.error, code: parsed.data.code },
    });
    return NextResponse.json({ error: created.error }, { status: 400 });
  }

  let referralSaved = false;
  if (parsed.data.saveAsAppReferral !== false && created.promotionCodeId) {
    try {
      await createReferralCode({
        code: parsed.data.code.trim().toUpperCase(),
        label: (parsed.data.name || parsed.data.code).trim(),
        stripePromotionCodeId: created.promotionCodeId,
        stripeCouponId: created.couponId,
        notes:
          parsed.data.notes ||
          `Created from Admin → Discounts · applies ${parsed.data.appliesTo}`,
      });
      referralSaved = true;
    } catch (e: unknown) {
      // Stripe objects already exist; app map is optional
      console.warn("[admin/billing/discounts] referral map save failed", e);
    }
  }

  await auditFromRequest(request, {
    action: "billing.discount.create",
    outcome: "success",
    actor: actorFromSession(auth.session),
    entityType: "stripe_coupon",
    entityId: created.couponId,
    metadata: {
      code: created.code,
      promotionCodeId: created.promotionCodeId,
      appliesTo: created.appliesTo,
      percentOff: parsed.data.percentOff ?? null,
      amountOffCents: parsed.data.amountOffCents ?? null,
      duration: parsed.data.duration,
      durationInMonths: parsed.data.durationInMonths ?? null,
      referralSaved,
      warning: created.warning ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    couponId: created.couponId,
    promotionCodeId: created.promotionCodeId,
    code: created.code,
    appliesTo: created.appliesTo,
    productIds: created.productIds,
    warning: created.warning,
    referralSaved,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  const result = await setPromotionCodeActive(parsed.data.promotionCodeId, parsed.data.active);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  await auditFromRequest(request, {
    action: "billing.discount.toggle",
    outcome: "success",
    actor: actorFromSession(auth.session),
    entityType: "stripe_promotion_code",
    entityId: parsed.data.promotionCodeId,
    metadata: { active: parsed.data.active },
  });
  return NextResponse.json({ ok: true });
}
