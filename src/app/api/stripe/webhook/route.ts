import { NextResponse } from "next/server";
import { updateMemberProfile } from "@/lib/member-profiles-store";
import { isCoachTipCheckoutMetadata } from "@/lib/coach-tips";
import { markMemberPaid } from "@/lib/mark-member-paid";
import { getStripe } from "@/lib/stripe";
import {
  checkoutCustomerId,
  checkoutSubscriptionId,
  persistCheckoutPaymentMethod,
  promoteCustomerFromInvoice,
} from "@/lib/stripe-payment-method-persist";
import { claimStripeWebhookEvent } from "@/lib/stripe-webhook-events";
import {
  isCheckoutSessionPaid,
  isSubscriptionActive,
} from "@/lib/stripe-payment-verify";
import { recordSubscriptionPaymentFact } from "@/lib/analytics-facts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const body = await request.text();
  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const isNew = await claimStripeWebhookEvent(event.id, event.type);
  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as import("stripe").Stripe.Checkout.Session;
      if (!isCheckoutSessionPaid(session)) break;

      const userId = session.metadata?.userId || session.client_reference_id;
      if (!userId) break;

      // Standalone coach tip — money on Jeremy’s Stripe; do not change membership.
      if (isCoachTipCheckoutMetadata(session.metadata)) {
        await persistCheckoutPaymentMethod(session);
        const tipCents =
          Number(session.metadata?.tipAmountCents) ||
          session.amount_total ||
          0;
        await recordSubscriptionPaymentFact({
          userId,
          stripePaymentIntentId: (() => {
            const pi = session.payment_intent;
            return typeof pi === "string" ? pi : pi && typeof pi === "object" && "id" in pi
              ? String((pi as { id: string }).id)
              : null;
          })(),
          stripeCustomerId: checkoutCustomerId(session),
          amountCents: tipCents,
          currency: session.currency ?? "usd",
          status: "paid",
          planId: "coach_tip",
          tierSlug: "coach_tip",
          billingReason: "coach_tip",
          paidAt: new Date(),
          stripeEventId: event.id,
          properties: {
            kind: "coach_tip",
            checkoutSessionId: session.id,
            tipLabel: session.metadata?.tipLabel ?? null,
          },
        });
        const { recordAuditEvent } = await import("@/lib/audit-event");
        await recordAuditEvent({
          action: "payment.tip",
          outcome: "success",
          actorRole: "system",
          entityType: "user",
          entityId: userId,
          metadata: {
            source: "stripe.webhook",
            tipAmountCents: tipCents,
            checkoutSessionId: session.id,
            stripeEventId: event.id,
          },
        });
        break;
      }

      const subscriptionId = checkoutSubscriptionId(session);
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        if (!isSubscriptionActive(sub)) break;
      }

      await persistCheckoutPaymentMethod(session);

      await markMemberPaid({
        userId,
        method: "stripe",
        plan: session.metadata?.plan ?? null,
        customOfferId: session.metadata?.customOfferId ?? null,
        stripeCustomerId: checkoutCustomerId(session),
        stripeSubscriptionId: subscriptionId,
        stripeCheckoutSessionId: session.id,
        actor: { role: "system" },
        auditSource: "stripe.webhook.checkout.session.completed",
      });
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as import("stripe").Stripe.Invoice;
      const subscriptionRef = (invoice as { subscription?: string | null }).subscription;
      if (typeof subscriptionRef !== "string") break;

      const sub = await stripe.subscriptions.retrieve(subscriptionRef);
      if (!isSubscriptionActive(sub)) break;

      await promoteCustomerFromInvoice(invoice);

      const userId = sub.metadata?.userId;
      if (userId) {
        await markMemberPaid({
          userId,
          method: "stripe",
          stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : null,
          stripeSubscriptionId: sub.id,
          actor: { role: "system" },
          auditSource: "stripe.webhook.invoice.paid",
        });
      }

      const paidAtSec =
        invoice.status_transitions?.paid_at ?? invoice.created ?? Math.floor(Date.now() / 1000);
      await recordSubscriptionPaymentFact({
        userId: userId ?? null,
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: (() => {
          const pi = (invoice as unknown as { payment_intent?: string | null }).payment_intent;
          return typeof pi === "string" ? pi : null;
        })(),
        stripeSubscriptionId: sub.id,
        stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : null,
        amountCents: invoice.amount_paid ?? 0,
        currency: invoice.currency ?? "usd",
        status: "paid",
        planId: sub.metadata?.plan ?? null,
        tierSlug: sub.metadata?.plan ?? null,
        billingReason: invoice.billing_reason ?? null,
        paidAt: new Date(paidAtSec * 1000),
        periodStart: invoice.period_start
          ? new Date(invoice.period_start * 1000)
          : null,
        periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
        stripeEventId: event.id,
        properties: {
          invoiceNumber: invoice.number,
          collectionMethod: invoice.collection_method,
        },
      });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as import("stripe").Stripe.Invoice;
      const subscriptionRef = (invoice as { subscription?: string | null }).subscription;
      if (typeof subscriptionRef !== "string") break;

      const sub = await stripe.subscriptions.retrieve(subscriptionRef);
      const userId = sub.metadata?.userId;
      if (userId) {
        await updateMemberProfile(userId, {
          paymentStatus: "failed",
          stripeSubscriptionId: sub.id,
        });
      }

      await recordSubscriptionPaymentFact({
        userId: userId ?? null,
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: sub.id,
        stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : null,
        amountCents: invoice.amount_due ?? 0,
        currency: invoice.currency ?? "usd",
        status: "failed",
        planId: sub.metadata?.plan ?? null,
        tierSlug: sub.metadata?.plan ?? null,
        paidAt: new Date(),
        stripeEventId: event.id,
      });
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as import("stripe").Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) break;

      if (isSubscriptionActive(sub)) {
        await markMemberPaid({
          userId,
          method: "stripe",
          stripeCustomerId: typeof sub.customer === "string" ? sub.customer : null,
          stripeSubscriptionId: sub.id,
          actor: { role: "system" },
          auditSource: "stripe.webhook.subscription.updated",
        });
      } else if (sub.status === "past_due" || sub.status === "unpaid") {
        await updateMemberProfile(userId, {
          paymentStatus: "failed",
          stripeSubscriptionId: sub.id,
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as import("stripe").Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) {
        await updateMemberProfile(userId, {
          paymentStatus: "failed",
          stripeSubscriptionId: sub.id,
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}