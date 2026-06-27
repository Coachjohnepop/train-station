#!/usr/bin/env node
/**
 * Sync demo/pricing-catalog.json blob with STRIPE_PRICE_* env vars.
 * Usage: vercel env run --environment=production -- node scripts/fix-pricing-catalog-prod.mjs
 */
import dotenv from "dotenv";
import { head, put } from "@vercel/blob";

dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.local" });

const BLOB_PATH = "demo/pricing-catalog.json";

const PLANS = [
  { planId: "member", env: "STRIPE_PRICE_MEMBER", label: "Coach Class", priceCents: 2500 },
  { planId: "business", env: "STRIPE_PRICE_BUSINESS", label: "Business Class", priceCents: 5000 },
  { planId: "pro", env: "STRIPE_PRICE_PRO", label: "1st Class", priceCents: 85000 },
];

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

const now = new Date().toISOString();
for (const plan of PLANS) {
  const stripePriceId = process.env[plan.env]?.trim();
  if (!stripePriceId) {
    console.warn(`Skip ${plan.planId}: ${plan.env} unset`);
    continue;
  }
  const current = existing.plans?.[plan.planId];
  existing.plans[plan.planId] = {
    planId: plan.planId,
    label: current?.label || plan.label,
    priceCents: current?.priceCents ?? plan.priceCents,
    stripePriceId,
    stripeProductId: current?.stripeProductId ?? null,
    enabled: current?.enabled !== false,
    updatedAt: now,
  };
  console.log(`${plan.planId}: ${stripePriceId}`);
}

existing.updatedAt = now;

await put(BLOB_PATH, JSON.stringify(existing, null, 2), {
  ...blobOpts,
  contentType: "application/json",
  addRandomSuffix: false,
  allowOverwrite: true,
});

console.log("✅ pricing catalog blob updated");