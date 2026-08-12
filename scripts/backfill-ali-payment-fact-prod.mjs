#!/usr/bin/env node
/**
 * Backfill Ali Fletcher's first payment into FactSubscriptionPayment.
 *
 * We could not pull Live Stripe secrets from this machine, so amount is derived
 * from product + promo on file:
 *   Coach Class list $25.00 · LETSGO26 = 80% off for two months → $5.00 (500¢)
 *
 * If Dashboard shows a different amount, re-run with:
 *   AMOUNT_CENTS=2500 node scripts/backfill-ali-payment-fact-prod.mjs
 *
 * Usage:
 *   node scripts/backfill-ali-payment-fact-prod.mjs
 *   DRY_RUN=1 node scripts/backfill-ali-payment-fact-prod.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.vercel.production" });
dotenv.config({ path: ".env.vercel.prod" });

import { createPgPool } from "../src/lib/pg-connection.ts";

const EMAIL = (process.env.EMAIL || "fletcherboys@att.net").trim().toLowerCase();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
/** Default: $5 from LETSGO26 (80% off $25 Coach Class). Override with AMOUNT_CENTS. */
const AMOUNT_CENTS = Number(process.env.AMOUNT_CENTS || 500);

const url =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "";
if (!url || url.includes("dummy")) {
  console.error("Need real Postgres URL");
  process.exit(1);
}

const pool = createPgPool(url);

async function main() {
  const { rows: users } = await pool.query(
    `SELECT id, email, name FROM "User" WHERE lower(email) = $1`,
    [EMAIL],
  );
  if (!users.length) {
    console.error("User not found", EMAIL);
    process.exit(1);
  }
  const user = users[0];
  const { rows: profiles } = await pool.query(
    `SELECT * FROM "MemberProfile" WHERE "userId" = $1`,
    [user.id],
  );
  const profile = profiles[0];
  if (!profile) {
    console.error("No profile");
    process.exit(1);
  }

  console.log("User", user.name, user.email, user.id);
  console.log("Profile paidAt", profile.paidAt, "referral", profile.referralCode);
  console.log("Stripe", {
    customer: profile.stripeCustomerId,
    sub: profile.stripeSubscriptionId,
    session: profile.stripeCheckoutSessionId,
  });

  const sessionId = profile.stripeCheckoutSessionId;
  if (sessionId) {
    const { rows: existing } = await pool.query(
      `SELECT id, "amountCents", status FROM "FactSubscriptionPayment"
       WHERE "userId" = $1
          OR ("properties"->>'checkoutSessionId') = $2
          OR "stripeSubscriptionId" = $3
       ORDER BY "paidAt" DESC LIMIT 5`,
      [user.id, sessionId, profile.stripeSubscriptionId],
    );
    console.log("Existing facts", existing);
    if (existing.some((r) => r.status === "paid" && r.amountCents > 0)) {
      console.log("Already has a paid fact — nothing to do.");
      await pool.end();
      return;
    }
  }

  const paidAt = profile.paidAt || new Date();
  const properties = {
    kind: "membership_checkout",
    checkoutSessionId: sessionId,
    mode: "subscription",
    referralCode: profile.referralCode || "LETSGO26",
    source: "backfill-ali-payment-fact-prod",
    amountSource:
      AMOUNT_CENTS === 500
        ? "catalog_$25_LETSGO26_80pct_off_two_months"
        : "manual_AMOUNT_cents_env",
    amountVerified: false,
    note: "Backfill — confirm exact amount in Eco Delight Stripe Live Dashboard if needed.",
  };

  if (DRY_RUN) {
    console.log("DRY_RUN would insert", {
      userId: user.id,
      amountCents: AMOUNT_CENTS,
      currency: "usd",
      paidAt,
      properties,
    });
    await pool.end();
    return;
  }

  const { rows: inserted } = await pool.query(
    `INSERT INTO "FactSubscriptionPayment" (
       id, "userId", "stripeInvoiceId", "stripePaymentIntentId", "stripeSubscriptionId",
       "stripeCustomerId", "amountCents", "amountRefundedCents", currency, status,
       "tierSlug", "planId", "billingReason", "paidAt", "periodStart", "periodEnd",
       "stripeEventId", properties
     ) VALUES (
       $1, $2, NULL, NULL, $3,
       $4, $5, 0, 'usd', 'paid',
       $6, $6, 'subscription_create', $7, NULL, NULL,
       NULL, $8::jsonb
     )
     RETURNING id, "amountCents", "paidAt"`,
    [
      // cuid-like
      `pay_backfill_${user.id.slice(-8)}_${Date.now().toString(36)}`,
      user.id,
      profile.stripeSubscriptionId,
      profile.stripeCustomerId,
      AMOUNT_CENTS,
      profile.plan || "member",
      paidAt,
      JSON.stringify(properties),
    ],
  );

  console.log("✓ Inserted FactSubscriptionPayment", inserted[0]);
  console.log(
    `  Amount: $${(AMOUNT_CENTS / 100).toFixed(2)} (set AMOUNT_CENTS to override if Dashboard differs)`,
  );
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
