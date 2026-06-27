import "server-only";

import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { getStripe } from "@/lib/stripe";

export async function ensureStripeCustomer(input: {
  userId: string;
  email: string;
  name?: string | null;
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const profile = await getMemberProfile(input.userId);
  const existingId = profile?.stripeCustomerId;
  if (existingId) {
    try {
      const customer = await stripe.customers.retrieve(existingId);
      if (!("deleted" in customer && customer.deleted)) {
        return existingId;
      }
    } catch {
      /* create a fresh customer below */
    }
  }

  const customer = await stripe.customers.create({
    email: input.email,
    name: input.name || undefined,
    metadata: { userId: input.userId },
  });

  await updateMemberProfile(input.userId, { stripeCustomerId: customer.id });
  return customer.id;
}

export async function customerHasSavedPaymentMethod(
  customerId: string,
): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe) return false;

  try {
    const methods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });
    return methods.data.length > 0;
  } catch {
    return false;
  }
}