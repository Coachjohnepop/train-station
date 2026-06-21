import { NextResponse } from "next/server";
import { syncMemberGateCookies } from "@/lib/auth";
import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { stripeAutoApproveOnPay } from "@/lib/member-gates";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function markMemberPaid(input: {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
}) {
  const profile = await getMemberProfile(input.userId);
  if (!profile) return null;

  const paidAt = new Date().toISOString();
  const patch: Parameters<typeof updateMemberProfile>[1] = {
    paymentStatus: "paid",
    paidAt,
    stripeCustomerId: input.stripeCustomerId ?? profile.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId ?? profile.stripeSubscriptionId,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? profile.stripeCheckoutSessionId,
  };

  if (stripeAutoApproveOnPay() && profile.approvalStatus === "pending") {
    patch.approvalStatus = "approved";
    patch.approvedAt = paidAt;
  }

  return updateMemberProfile(input.userId, patch);
}

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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as import("stripe").Stripe.Checkout.Session;
      const userId = session.metadata?.userId || session.client_reference_id;
      if (userId) {
        await markMemberPaid({
          userId,
          stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
          stripeSubscriptionId:
            typeof session.subscription === "string" ? session.subscription : null,
          stripeCheckoutSessionId: session.id,
        });
      }
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as import("stripe").Stripe.Invoice;
      const subscriptionRef = (invoice as { subscription?: string | null }).subscription;
      if (typeof subscriptionRef === "string") {
        const sub = await stripe.subscriptions.retrieve(subscriptionRef);
        const userId = sub.metadata?.userId;
        if (userId) {
          await markMemberPaid({
            userId,
            stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : null,
            stripeSubscriptionId: sub.id,
          });
        }
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