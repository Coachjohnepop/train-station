import "server-only";

import { prisma } from "@/lib/prisma";

/** Returns true if this is a new event; false if already processed (replay). */
export async function claimStripeWebhookEventInDb(
  eventId: string,
  eventType: string,
): Promise<boolean> {
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        eventId,
        type: eventType,
        processedAt: new Date(),
      },
    });
    return true;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code: string }).code
        : null;
    if (code === "P2002") return false;
    throw error;
  }
}

export async function probeStripeWebhookEventsDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.stripeWebhookEvent.count();
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe webhook events DB probe failed";
    return { ok: false, message };
  }
}