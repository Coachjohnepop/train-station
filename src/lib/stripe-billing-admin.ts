import "server-only";

import { getStripe, getStripePublishableKey } from "@/lib/stripe";
import { isStripeTestMode } from "@/lib/stripe-price-ids";
import { fetchActiveMrrCents, formatUsdFromCents } from "@/lib/stripe-commission";
import { listMemberProfiles } from "@/lib/member-profiles-store";

export type BillingTransaction = {
  id: string;
  paymentIntentId: string | null;
  amountCents: number;
  amountRefundedCents: number;
  amountLabel: string;
  refundedLabel: string;
  netLabel: string;
  currency: string;
  status: string;
  paid: boolean;
  refunded: boolean;
  partiallyRefunded: boolean;
  refundableCents: number;
  description: string | null;
  receiptEmail: string | null;
  customerId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  memberUserId: string | null;
  memberPlan: string | null;
  createdAt: string;
  cardBrand: string | null;
  cardLast4: string | null;
  failureMessage: string | null;
};

export type BillingRefund = {
  id: string;
  chargeId: string | null;
  paymentIntentId: string | null;
  amountCents: number;
  amountLabel: string;
  currency: string;
  status: string;
  reason: string | null;
  createdAt: string;
  receiptNumber: string | null;
};

export type BillingCoupon = {
  id: string;
  name: string | null;
  percentOff: number | null;
  amountOffCents: number | null;
  amountOffLabel: string | null;
  currency: string | null;
  duration: string;
  durationInMonths: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  valid: boolean;
  createdAt: string;
  redeemBy: string | null;
};

export type BillingPromotionCode = {
  id: string;
  code: string;
  active: boolean;
  couponId: string;
  couponSummary: string;
  maxRedemptions: number | null;
  timesRedeemed: number;
  expiresAt: string | null;
  createdAt: string;
};

export type BillingSubscription = {
  id: string;
  status: string;
  customerEmail: string | null;
  customerName: string | null;
  planLabel: string;
  amountCents: number | null;
  amountLabel: string | null;
  interval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
};

function money(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function customerEmail(
  customer: string | import("stripe").Stripe.Customer | import("stripe").Stripe.DeletedCustomer | null,
): string | null {
  if (!customer || typeof customer === "string") return null;
  if ("deleted" in customer && customer.deleted) return null;
  return customer.email || null;
}

function customerName(
  customer: string | import("stripe").Stripe.Customer | import("stripe").Stripe.DeletedCustomer | null,
): string | null {
  if (!customer || typeof customer === "string") return null;
  if ("deleted" in customer && customer.deleted) return null;
  return customer.name || null;
}

function customerIdOf(
  customer: string | import("stripe").Stripe.Customer | import("stripe").Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id;
}

export async function getBillingAdminOverview() {
  const stripe = getStripe();
  if (!stripe) {
    return {
      configured: false as const,
      testMode: isStripeTestMode(),
      publishableKeyPresent: Boolean(getStripePublishableKey()),
      message: "Stripe is not configured (missing STRIPE_SECRET_KEY).",
    };
  }

  const [balance, mrr, charges, refunds, openPi] = await Promise.all([
    stripe.balance.retrieve().catch(() => null),
    fetchActiveMrrCents(),
    stripe.charges.list({ limit: 100 }),
    stripe.refunds.list({ limit: 50 }),
    stripe.paymentIntents.list({ limit: 30, expand: [] }),
  ]);

  const now = Date.now();
  const day30 = now - 30 * 24 * 60 * 60 * 1000;
  const day7 = now - 7 * 24 * 60 * 60 * 1000;

  let gross30 = 0;
  let refunded30 = 0;
  let gross7 = 0;
  let succeeded = 0;
  let failed = 0;

  for (const c of charges.data) {
    const createdMs = c.created * 1000;
    if (c.paid && c.status === "succeeded") {
      if (createdMs >= day30) {
        gross30 += c.amount;
        refunded30 += c.amount_refunded || 0;
      }
      if (createdMs >= day7) gross7 += c.amount;
      succeeded += 1;
    } else if (c.status === "failed") {
      failed += 1;
    }
  }

  const available =
    balance?.available?.reduce((sum, b) => sum + (b.currency === "usd" ? b.amount : 0), 0) ?? null;
  const pending =
    balance?.pending?.reduce((sum, b) => sum + (b.currency === "usd" ? b.amount : 0), 0) ?? null;

  const requiresAction = openPi.data.filter(
    (pi) => pi.status === "requires_action" || pi.status === "requires_payment_method",
  ).length;

  return {
    configured: true as const,
    testMode: isStripeTestMode(),
    publishableKeyPresent: Boolean(getStripePublishableKey()),
    message: null as string | null,
    balance: {
      availableCents: available,
      availableLabel: available == null ? null : formatUsdFromCents(available),
      pendingCents: pending,
      pendingLabel: pending == null ? null : formatUsdFromCents(pending),
    },
    mrr: {
      cents: mrr.mrrCents,
      label: formatUsdFromCents(mrr.mrrCents),
      activeSubscriptions: mrr.activeSubscriptions,
    },
    volume: {
      gross30Cents: gross30,
      gross30Label: formatUsdFromCents(gross30),
      refunded30Cents: refunded30,
      refunded30Label: formatUsdFromCents(refunded30),
      net30Cents: gross30 - refunded30,
      net30Label: formatUsdFromCents(gross30 - refunded30),
      gross7Cents: gross7,
      gross7Label: formatUsdFromCents(gross7),
    },
    counts: {
      chargesLoaded: charges.data.length,
      refundsLoaded: refunds.data.length,
      succeededCharges: succeeded,
      failedCharges: failed,
      openPaymentIntents: requiresAction,
    },
  };
}

export async function listBillingTransactions(limit = 50): Promise<{
  transactions: BillingTransaction[];
  error?: string;
}> {
  const stripe = getStripe();
  if (!stripe) return { transactions: [], error: "Stripe is not configured." };

  const [charges, profiles] = await Promise.all([
    stripe.charges.list({
      limit: Math.min(100, Math.max(1, limit)),
      expand: ["data.customer", "data.refunds"],
    }),
    listMemberProfiles().catch(() => []),
  ]);

  const byCustomer = new Map<string, { userId: string; plan: string; email: string }>();
  const byEmail = new Map<string, { userId: string; plan: string; email: string }>();
  for (const p of profiles) {
    if (p.stripeCustomerId) {
      byCustomer.set(p.stripeCustomerId, {
        userId: p.userId,
        plan: p.plan,
        email: p.email,
      });
    }
    if (p.email) {
      byEmail.set(p.email.toLowerCase(), {
        userId: p.userId,
        plan: p.plan,
        email: p.email,
      });
    }
  }

  const transactions: BillingTransaction[] = charges.data.map((c) => {
    const custId = customerIdOf(c.customer);
    const email = customerEmail(c.customer) || c.billing_details?.email || c.receipt_email || null;
    const member =
      (custId && byCustomer.get(custId)) ||
      (email && byEmail.get(email.toLowerCase())) ||
      null;
    const refunded = c.refunded || (c.amount_refunded || 0) >= c.amount;
    const partiallyRefunded = !refunded && (c.amount_refunded || 0) > 0;
    const refundable = Math.max(0, c.amount - (c.amount_refunded || 0));
    const net = c.amount - (c.amount_refunded || 0);

    return {
      id: c.id,
      paymentIntentId: typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id || null,
      amountCents: c.amount,
      amountRefundedCents: c.amount_refunded || 0,
      amountLabel: money(c.amount, c.currency),
      refundedLabel: money(c.amount_refunded || 0, c.currency),
      netLabel: money(net, c.currency),
      currency: c.currency,
      status: c.status,
      paid: Boolean(c.paid),
      refunded,
      partiallyRefunded,
      refundableCents: c.paid && c.status === "succeeded" ? refundable : 0,
      description: c.description || c.calculated_statement_descriptor || null,
      receiptEmail: c.receipt_email || email,
      customerId: custId,
      customerEmail: email,
      customerName: customerName(c.customer) || c.billing_details?.name || null,
      memberUserId: member?.userId || null,
      memberPlan: member?.plan || null,
      createdAt: new Date(c.created * 1000).toISOString(),
      cardBrand: c.payment_method_details?.card?.brand || null,
      cardLast4: c.payment_method_details?.card?.last4 || null,
      failureMessage: c.failure_message || null,
    };
  });

  return { transactions };
}

export async function listBillingRefunds(limit = 50): Promise<{
  refunds: BillingRefund[];
  error?: string;
}> {
  const stripe = getStripe();
  if (!stripe) return { refunds: [], error: "Stripe is not configured." };

  const list = await stripe.refunds.list({ limit: Math.min(100, Math.max(1, limit)) });
  const refunds: BillingRefund[] = list.data.map((r) => ({
    id: r.id,
    chargeId: typeof r.charge === "string" ? r.charge : r.charge?.id || null,
    paymentIntentId:
      typeof r.payment_intent === "string" ? r.payment_intent : r.payment_intent?.id || null,
    amountCents: r.amount,
    amountLabel: money(r.amount, r.currency),
    currency: r.currency,
    status: r.status || "unknown",
    reason: r.reason || null,
    createdAt: new Date(r.created * 1000).toISOString(),
    receiptNumber: r.receipt_number || null,
  }));

  return { refunds };
}

export async function createBillingRefund(input: {
  chargeId: string;
  amountCents?: number | null;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer" | null;
  note?: string | null;
}): Promise<{ ok: true; refund: BillingRefund } | { ok: false; error: string }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe is not configured." };

  try {
    const charge = await stripe.charges.retrieve(input.chargeId);
    const already = charge.amount_refunded || 0;
    const maxRefundable = charge.amount - already;
    if (maxRefundable <= 0) {
      return { ok: false, error: "This charge is already fully refunded." };
    }

    let amount = input.amountCents ?? null;
    if (amount != null) {
      amount = Math.round(amount);
      if (amount <= 0) return { ok: false, error: "Refund amount must be greater than zero." };
      if (amount > maxRefundable) {
        return {
          ok: false,
          error: `Max refundable is ${money(maxRefundable, charge.currency)} (${maxRefundable} cents).`,
        };
      }
    }

    const refund = await stripe.refunds.create({
      charge: input.chargeId,
      ...(amount != null ? { amount } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
      metadata: {
        source: "train-station-admin-billing",
        ...(input.note?.trim() ? { note: input.note.trim().slice(0, 400) } : {}),
      },
    });

    return {
      ok: true,
      refund: {
        id: refund.id,
        chargeId: typeof refund.charge === "string" ? refund.charge : refund.charge?.id || null,
        paymentIntentId:
          typeof refund.payment_intent === "string"
            ? refund.payment_intent
            : refund.payment_intent?.id || null,
        amountCents: refund.amount,
        amountLabel: money(refund.amount, refund.currency),
        currency: refund.currency,
        status: refund.status || "unknown",
        reason: refund.reason || null,
        createdAt: new Date(refund.created * 1000).toISOString(),
        receiptNumber: refund.receipt_number || null,
      },
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Refund failed.";
    console.error("[billing] refund failed", message);
    return { ok: false, error: message };
  }
}

export async function listBillingCouponsAndPromos(): Promise<{
  coupons: BillingCoupon[];
  promotionCodes: BillingPromotionCode[];
  error?: string;
}> {
  const stripe = getStripe();
  if (!stripe) {
    return { coupons: [], promotionCodes: [], error: "Stripe is not configured." };
  }

  const [couponsList, promosList] = await Promise.all([
    stripe.coupons.list({ limit: 100 }),
    stripe.promotionCodes.list({ limit: 100, expand: ["data.promotion.coupon"] }),
  ]);

  const coupons: BillingCoupon[] = couponsList.data.map((c) => ({
    id: c.id,
    name: c.name,
    percentOff: c.percent_off,
    amountOffCents: c.amount_off,
    amountOffLabel: c.amount_off != null ? money(c.amount_off, c.currency || "usd") : null,
    currency: c.currency,
    duration: c.duration,
    durationInMonths: c.duration_in_months,
    maxRedemptions: c.max_redemptions,
    timesRedeemed: c.times_redeemed || 0,
    valid: c.valid,
    createdAt: new Date(c.created * 1000).toISOString(),
    redeemBy: c.redeem_by ? new Date(c.redeem_by * 1000).toISOString() : null,
  }));

  const promotionCodes: BillingPromotionCode[] = promosList.data.map((p) => {
    const promoCoupon = p.promotion?.coupon;
    const coupon = typeof promoCoupon === "string" ? null : promoCoupon;
    let couponSummary =
      typeof promoCoupon === "string" ? promoCoupon : promoCoupon?.id || "";
    if (coupon) {
      if (coupon.percent_off != null) couponSummary = `${coupon.percent_off}% off`;
      else if (coupon.amount_off != null) {
        couponSummary = money(coupon.amount_off, coupon.currency || "usd");
      }
    }
    return {
      id: p.id,
      code: p.code,
      active: p.active,
      couponId: typeof promoCoupon === "string" ? promoCoupon : promoCoupon?.id || "",
      couponSummary,
      maxRedemptions: p.max_redemptions,
      timesRedeemed: p.times_redeemed || 0,
      expiresAt: p.expires_at ? new Date(p.expires_at * 1000).toISOString() : null,
      createdAt: new Date(p.created * 1000).toISOString(),
    };
  });

  return { coupons, promotionCodes };
}

export async function createBillingDiscount(input: {
  code: string;
  name?: string | null;
  percentOff?: number | null;
  amountOffCents?: number | null;
  currency?: string;
  duration: "once" | "repeating" | "forever";
  durationInMonths?: number | null;
  maxRedemptions?: number | null;
  expiresAtIso?: string | null;
  createPromotionCode?: boolean;
}): Promise<
  | {
      ok: true;
      couponId: string;
      promotionCodeId: string | null;
      code: string | null;
    }
  | { ok: false; error: string }
> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe is not configured." };

  const code = input.code.trim().toUpperCase().replace(/\s+/g, "");
  if (code.length < 2) return { ok: false, error: "Discount code must be at least 2 characters." };

  const percent = input.percentOff != null ? Number(input.percentOff) : null;
  const amountOff = input.amountOffCents != null ? Math.round(Number(input.amountOffCents)) : null;

  if ((percent == null || !Number.isFinite(percent)) && (amountOff == null || !Number.isFinite(amountOff))) {
    return { ok: false, error: "Set a percent off or a fixed amount off." };
  }
  if (percent != null && (percent <= 0 || percent > 100)) {
    return { ok: false, error: "Percent off must be between 1 and 100." };
  }
  if (amountOff != null && amountOff <= 0) {
    return { ok: false, error: "Amount off must be greater than zero." };
  }
  if (input.duration === "repeating" && (!input.durationInMonths || input.durationInMonths < 1)) {
    return { ok: false, error: "Repeating coupons need duration in months." };
  }

  try {
    const coupon = await stripe.coupons.create({
      name: (input.name || code).slice(0, 40),
      duration: input.duration,
      ...(input.duration === "repeating" && input.durationInMonths
        ? { duration_in_months: input.durationInMonths }
        : {}),
      ...(percent != null ? { percent_off: percent } : {}),
      ...(amountOff != null
        ? { amount_off: amountOff, currency: (input.currency || "usd").toLowerCase() }
        : {}),
      ...(input.maxRedemptions != null && input.maxRedemptions > 0
        ? { max_redemptions: input.maxRedemptions }
        : {}),
      ...(input.expiresAtIso
        ? { redeem_by: Math.floor(new Date(input.expiresAtIso).getTime() / 1000) }
        : {}),
      metadata: { source: "train-station-admin-billing", code },
    });

    let promotionCodeId: string | null = null;
    let promoCode: string | null = null;
    if (input.createPromotionCode !== false) {
      const promo = await stripe.promotionCodes.create({
        promotion: { type: "coupon", coupon: coupon.id },
        code,
        ...(input.maxRedemptions != null && input.maxRedemptions > 0
          ? { max_redemptions: input.maxRedemptions }
          : {}),
        ...(input.expiresAtIso
          ? { expires_at: Math.floor(new Date(input.expiresAtIso).getTime() / 1000) }
          : {}),
        metadata: { source: "train-station-admin-billing" },
      });
      promotionCodeId = promo.id;
      promoCode = promo.code;
    }

    return {
      ok: true,
      couponId: coupon.id,
      promotionCodeId,
      code: promoCode,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not create discount.";
    console.error("[billing] create discount failed", message);
    return { ok: false, error: message };
  }
}

export async function setPromotionCodeActive(
  promotionCodeId: string,
  active: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe is not configured." };
  try {
    await stripe.promotionCodes.update(promotionCodeId, { active });
    return { ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not update promotion code.";
    return { ok: false, error: message };
  }
}

export async function listBillingSubscriptions(limit = 40): Promise<{
  subscriptions: BillingSubscription[];
  error?: string;
}> {
  const stripe = getStripe();
  if (!stripe) return { subscriptions: [], error: "Stripe is not configured." };

  const list = await stripe.subscriptions.list({
    limit: Math.min(100, Math.max(1, limit)),
    status: "all",
    expand: ["data.customer", "data.items.data.price"],
  });

  const subscriptions: BillingSubscription[] = list.data.map((s) => {
    const item = s.items.data[0];
    const price = item?.price;
    const amount = price?.unit_amount ?? null;
    const interval = price?.recurring?.interval || null;
    const planLabel = price?.nickname || price?.id || "Subscription";
    const periodEnd =
      item && "current_period_end" in item && typeof item.current_period_end === "number"
        ? item.current_period_end
        : (s as { current_period_end?: number }).current_period_end;
    return {
      id: s.id,
      status: s.status,
      customerEmail: customerEmail(s.customer),
      customerName: customerName(s.customer),
      planLabel,
      amountCents: amount,
      amountLabel: amount != null ? money(amount, price?.currency || "usd") : null,
      interval,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
      createdAt: new Date(s.created * 1000).toISOString(),
    };
  });

  return { subscriptions };
}
