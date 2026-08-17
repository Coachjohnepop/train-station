import "server-only";

import { getMemberProfile } from "@/lib/member-profiles-store";
import { getStripe } from "@/lib/stripe";
import { signupPlanLabel, normalizeSignupPlan } from "@/lib/signup-plans";
import type Stripe from "stripe";

export type CheckoutReceipt = {
  sessionId: string;
  status: string;
  paymentStatus: string;
  amountTotalCents: number | null;
  amountTotalLabel: string | null;
  currency: string | null;
  plan: string | null;
  planLabel: string | null;
  productName: string | null;
  paidAt: string | null;
  customerEmail: string | null;
  paymentMethod: "card" | "stripe" | "unknown";
  cardBrand: string | null;
  cardLast4: string | null;
  subscriptionId: string | null;
  invoiceId: string | null;
  receiptUrl: string | null;
  nextPath: string;
};

function money(cents: number | null | undefined, currency = "usd"): string | null {
  if (cents == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format(cents / 100);
}

function sessionPaidAt(session: Stripe.Checkout.Session): string | null {
  if (session.created) return new Date(session.created * 1000).toISOString();
  return null;
}

export async function buildCheckoutReceiptForUser(
  userId: string,
  sessionId: string,
): Promise<CheckoutReceipt | { error: string; status: number }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured.", status: 503 };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "payment_intent.latest_charge", "subscription", "line_items"],
    });
  } catch {
    return { error: "Checkout session not found.", status: 404 };
  }

  const owner = session.metadata?.userId || session.client_reference_id;
  if (!owner || owner !== userId) {
    return { error: "This receipt is not for your account.", status: 403 };
  }

  const planRaw = session.metadata?.plan || null;
  const plan = planRaw ? normalizeSignupPlan(planRaw) : null;
  const planLabel = plan ? signupPlanLabel(plan) : null;

  let productName: string | null = null;
  const lineItems = session.line_items?.data;
  if (lineItems?.[0]?.description) productName = lineItems[0].description;
  else if (lineItems?.[0]?.price && typeof lineItems[0].price === "object") {
    const p = lineItems[0].price as Stripe.Price;
    productName =
      (typeof p.product === "object" && p.product && !("deleted" in p.product)
        ? p.product.name
        : null) || planLabel;
  }

  let cardBrand: string | null = null;
  let cardLast4: string | null = null;
  let receiptUrl: string | null = null;
  let invoiceId: string | null = null;

  const pi =
    typeof session.payment_intent === "object" && session.payment_intent
      ? session.payment_intent
      : null;
  if (pi && "latest_charge" in pi && pi.latest_charge) {
    const charge =
      typeof pi.latest_charge === "object"
        ? pi.latest_charge
        : await stripe.charges.retrieve(pi.latest_charge as string).catch(() => null);
    if (charge && typeof charge === "object" && !("deleted" in charge)) {
      receiptUrl = charge.receipt_url || null;
      cardBrand = charge.payment_method_details?.card?.brand || null;
      cardLast4 = charge.payment_method_details?.card?.last4 || null;
    }
  }

  if (session.invoice) {
    invoiceId = typeof session.invoice === "string" ? session.invoice : session.invoice.id;
    if (!receiptUrl && invoiceId) {
      try {
        const inv = await stripe.invoices.retrieve(invoiceId);
        receiptUrl = inv.hosted_invoice_url || inv.invoice_pdf || null;
      } catch {
        /* ignore */
      }
    }
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || null;

  const isTip = session.metadata?.kind === "coach_tip" || session.metadata?.tip === "true";
  const nextPath = isTip
    ? "/member/account?tipped=1"
    : `/member/onboard?plan=${encodeURIComponent(plan || "member")}`;

  return {
    sessionId: session.id,
    status: session.status || "unknown",
    paymentStatus: session.payment_status || "unknown",
    amountTotalCents: session.amount_total,
    amountTotalLabel: money(session.amount_total, session.currency || "usd"),
    currency: session.currency || "usd",
    plan,
    planLabel,
    productName: productName || planLabel,
    paidAt: sessionPaidAt(session),
    customerEmail: session.customer_details?.email || session.customer_email || null,
    paymentMethod: cardLast4 ? "card" : "stripe",
    cardBrand,
    cardLast4,
    subscriptionId,
    invoiceId,
    receiptUrl,
    nextPath,
  };
}

/** Latest membership checkout session stored on the member profile. */
export async function latestReceiptSessionIdForUser(userId: string): Promise<string | null> {
  const profile = await getMemberProfile(userId);
  return profile?.stripeCheckoutSessionId?.trim() || null;
}
