import { NextResponse } from "next/server";
import { updateMemberProfile } from "@/lib/member-profiles-store";
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
        });
      }
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