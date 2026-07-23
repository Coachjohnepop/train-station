import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import {
  TIP_CUSTOM_MAX_DOLLARS,
  TIP_CUSTOM_MIN_DOLLARS,
  TIP_PRESET_DOLLARS,
  dollarsToCents,
} from "@/lib/coach-tips";
import { isStripePaymentsEnabled } from "@/lib/member-gates";
import { createCoachTipCheckoutSession } from "@/lib/stripe";
import { publicTipConfig } from "@/lib/stripe-checkout-tips";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** Whole dollars, e.g. 5 | 10 | 25 | 50 or custom 1–200. */
  amountDollars: z.number().int().min(TIP_CUSTOM_MIN_DOLLARS).max(TIP_CUSTOM_MAX_DOLLARS),
});

/** Create embedded Checkout for a one-time coach tip. */
export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== "MEMBER") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    if (!isStripePaymentsEnabled()) {
      return NextResponse.json({ error: "Card tips are not available right now." }, { status: 503 });
    }

    const tipCfg = publicTipConfig();
    if (!tipCfg.enabled) {
      return NextResponse.json(
        { error: "Tips aren’t set up yet. Message your coach — or check back soon." },
        { status: 503 },
      );
    }

    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: `Pick a tip between $${TIP_CUSTOM_MIN_DOLLARS} and $${TIP_CUSTOM_MAX_DOLLARS}.`,
        },
        { status: 400 },
      );
    }

    const dollars = parsed.data.amountDollars;
    const isListedPreset = tipCfg.presets.includes(
      dollars as (typeof TIP_PRESET_DOLLARS)[number],
    );
    if (!isListedPreset && !tipCfg.customEnabled) {
      return NextResponse.json(
        { error: "Choose one of the tip chips." },
        { status: 400 },
      );
    }

    const checkout = await createCoachTipCheckoutSession({
      userId: session.id,
      email: session.email,
      name: session.name,
      amountCents: dollarsToCents(dollars),
    });

    if ("error" in checkout) {
      return NextResponse.json({ error: checkout.error }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      clientSecret: checkout.clientSecret,
      sessionId: checkout.sessionId,
      hasSavedCard: checkout.hasSavedCard,
      amountCents: checkout.amountCents,
      amountDollars: dollars,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Tip checkout failed.";
    console.error("[stripe/tip] unexpected error", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Tip config for the Account / tip UI (authenticated members). */
export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const tips = publicTipConfig();
  return NextResponse.json({
    ok: true,
    tips,
    stripeEnabled: isStripePaymentsEnabled(),
  });
}
