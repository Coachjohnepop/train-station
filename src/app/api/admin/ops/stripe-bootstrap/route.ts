import { NextResponse } from "next/server";
import { requirePlatformStaff, cronAuthorized } from "@/lib/api-auth";
import { actorFromSession, auditFromRequest } from "@/lib/audit-request";
import { runStripeOpsBootstrap } from "@/lib/stripe-ops-bootstrap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Idempotent tips + FEEDBACK50 bootstrap on the Stripe account wired to Vercel.
 *
 * Auth: platform staff session OR Bearer OPS_BOOTSTRAP_SECRET / CRON_SECRET.
 */
export async function POST(request: Request) {
  const staff = await requirePlatformStaff();
  const cronOk = cronAuthorized(request, [
    process.env.OPS_BOOTSTRAP_SECRET,
    process.env.CRON_SECRET,
  ]);

  if (!staff.ok && !cronOk) {
    if (!staff.ok) return staff.response;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runStripeOpsBootstrap();
    if ("error" in result) {
      if (staff.ok) {
        await auditFromRequest(request, {
          action: "ops.stripe_bootstrap",
          outcome: "failure",
          actor: actorFromSession(staff.session),
          metadata: { error: result.error },
        });
      }
      return NextResponse.json({ error: result.error }, { status: 503 });
    }

    if (staff.ok) {
      await auditFromRequest(request, {
        action: "ops.stripe_bootstrap",
        outcome: "success",
        actor: actorFromSession(staff.session),
        metadata: {
          mode: result.mode,
          accountId: result.accountId,
          tipProductId: result.tipProductId,
          feedbackCode: result.feedback.code,
          tipKeys: Object.keys(result.tipEnv),
          membershipKeys: Object.keys(result.membershipEnv || {}),
        },
      });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Bootstrap crashed";
    console.error("[ops/stripe-bootstrap]", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // Same auth as POST — status probe without creating.
  const staff = await requirePlatformStaff();
  const cronOk = cronAuthorized(request, [
    process.env.OPS_BOOTSTRAP_SECRET,
    process.env.CRON_SECRET,
  ]);
  if (!staff.ok && !cronOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tipsConfigured = Boolean(
    process.env.STRIPE_PRICE_TIP_5 ||
      process.env.STRIPE_PRICE_TIP_10 ||
      process.env.STRIPE_PRICE_TIP_CUSTOM ||
      process.env.STRIPE_PRICE_TIPS,
  );

  return NextResponse.json({
    ok: true,
    tipsEnvConfigured: tipsConfigured,
    tipEnvPresent: {
      STRIPE_PRICE_TIP_5: Boolean(process.env.STRIPE_PRICE_TIP_5?.startsWith("price_")),
      STRIPE_PRICE_TIP_10: Boolean(process.env.STRIPE_PRICE_TIP_10?.startsWith("price_")),
      STRIPE_PRICE_TIP_25: Boolean(process.env.STRIPE_PRICE_TIP_25?.startsWith("price_")),
      STRIPE_PRICE_TIP_50: Boolean(process.env.STRIPE_PRICE_TIP_50?.startsWith("price_")),
      STRIPE_PRICE_TIP_CUSTOM: Boolean(
        process.env.STRIPE_PRICE_TIP_CUSTOM?.startsWith("price_"),
      ),
    },
    hasStripeSecret: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    security: {
      SECURITY_ENFORCED: process.env.SECURITY_ENFORCED,
      ALLOW_DEV_SWITCHER: process.env.ALLOW_DEV_SWITCHER,
      STRIPE_REQUIRED: process.env.STRIPE_REQUIRED,
      ALLOW_BLANK_PASSWORD: process.env.ALLOW_BLANK_PASSWORD,
    },
  });
}
