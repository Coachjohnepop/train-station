#!/usr/bin/env node
/**
 * Sync demo/pricing-catalog.json blob with canonical Stripe price IDs.
 * Usage: node scripts/fix-pricing-catalog-prod.mjs
 */
import dotenv from "dotenv";
import { head, put } from "@vercel/blob";
import { STRIPE_PRICE_IDS, STRIPE_PRICE_LABELS } from "./stripe-price-ids.mjs";

if (process.env.VERCEL !== "1") {
  dotenv.config({ path: ".env.vercel.prod" });
  dotenv.config({ path: ".env.local" });
}

const BLOB_PATH = "demo/pricing-catalog.json";

const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.TS_BLOB_TOKEN;
if (!token) {
  console.error("Missing BLOB_READ_WRITE_TOKEN or TS_BLOB_TOKEN");
  process.exit(1);
}

const blobOpts = { access: "public", token };

let existing = { plans: {}, updatedAt: new Date().toISOString() };
try {
  const meta = await head(BLOB_PATH, blobOpts);
  const res = await fetch(`${meta.url}?_ts=${Date.now()}`, { cache: "no-store" });
  if (res.ok) existing = await res.json();
} catch {
  // new catalog
}

const secret = process.env.STRIPE_SECRET_KEY?.trim() || "";
const isLive = secret.startsWith("sk_live_");
const priceIds = isLive
  ? {
      member: process.env.STRIPE_PRICE_MEMBER?.trim(),
      business: process.env.STRIPE_PRICE_BUSINESS?.trim(),
      pro: process.env.STRIPE_PRICE_PRO?.trim(),
    }
  : STRIPE_PRICE_IDS;

if (isLive && !Object.values(priceIds).every(Boolean)) {
  console.warn(
    "[pricing-catalog] Live Stripe key set but STRIPE_PRICE_MEMBER/BUSINESS/PRO missing — skip blob sync",
  );
  process.exit(0);
}

const now = new Date().toISOString();
for (const [planId, stripePriceId] of Object.entries(priceIds)) {
  if (!stripePriceId) continue;
  const meta = STRIPE_PRICE_LABELS[planId];
  const current = existing.plans?.[planId];
  existing.plans[planId] = {
    planId,
    label: current?.label || meta.label,
    priceCents: current?.priceCents ?? meta.priceCents,
    stripePriceId,
    stripeProductId: current?.stripeProductId ?? null,
    enabled: current?.enabled !== false,
    updatedAt: now,
  };
  console.log(`${planId}: ${stripePriceId}`);
}

existing.updatedAt = now;

await put(BLOB_PATH, JSON.stringify(existing, null, 2), {
  ...blobOpts,
  contentType: "application/json",
  addRandomSuffix: false,
  allowOverwrite: true,
});

console.log("✅ pricing catalog blob updated");