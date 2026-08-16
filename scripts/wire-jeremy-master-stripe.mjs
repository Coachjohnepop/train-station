#!/usr/bin/env node
/**
 * Wire Jeremy's Stripe as Train Station master merchant (Production).
 *
 * Order of money model:
 *   1) Jeremy master Stripe = merchant of record (this script)
 *   2) John = Connect partner for commission / profit-share (later, separate)
 *
 * Usage:
 *   # 1) Put Jeremy Live keys in a local file (never commit):
 *   #    .env.jeremy.live  (gitignored)
 *   #      STRIPE_SECRET_KEY=sk_live_...
 *   #      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
 *   #      STRIPE_WEBHOOK_SECRET=whsec_...   # optional now; set after webhook exists
#      STRIPE_SECRET_KEY_LEGACY=sk_live_...   # current Eco Production secret
#      STRIPE_WEBHOOK_SECRET_LEGACY=whsec_... # current Eco Production webhook
 *
 *   # 2) Identify only (no Vercel writes):
 *   node scripts/wire-jeremy-master-stripe.mjs --identify
 *
 *   # 3) Push keys + price env to Vercel Production + print next steps:
 *   node scripts/wire-jeremy-master-stripe.mjs --push-vercel
 *
 * Requires: network, curl, vercel CLI logged in as john-9066.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ENV_FILE = resolve(ROOT, ".env.jeremy.live");
const EXPECTED_HINTS = [
  "acct_1TmKSWQWWnajU9uyk", // documented Jeremy Live (CONTEXT.md)
];

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function mask(key) {
  if (!key) return "(missing)";
  if (key.length < 16) return "(short)";
  return `${key.slice(0, 12)}…${key.slice(-4)} (len ${key.length})`;
}

async function stripeGet(path, secret) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || res.statusText;
    throw new Error(`Stripe ${path}: ${msg}`);
  }
  return body;
}

function vercelEnvSet(name, value, environment = "production") {
  // Remove existing then add (force) so sensitive Production keys update cleanly.
  const rm = spawnSync(
    "vercel",
    ["env", "rm", name, environment, "--yes"],
    { cwd: ROOT, encoding: "utf8" },
  );
  // ignore rm failure if missing
  const add = spawnSync(
    "vercel",
    [
      "env",
      "add",
      name,
      environment,
      "--sensitive",
      "--force",
      "--yes",
      "--value",
      value,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (add.status !== 0) {
    throw new Error(
      `vercel env add ${name} failed:\n${add.stdout || ""}\n${add.stderr || ""}`,
    );
  }
  console.log(`  ✓ Vercel ${environment}: ${name}`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const identifyOnly = args.has("--identify") || !args.has("--push-vercel");
  const push = args.has("--push-vercel");

  const fileEnv = loadEnvFile(ENV_FILE);
  const secret =
    process.env.STRIPE_SECRET_KEY?.trim() ||
    fileEnv.STRIPE_SECRET_KEY?.trim() ||
    "";
  const publishable =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
    fileEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
    fileEnv.STRIPE_PUBLISHABLE_KEY?.trim() ||
    "";
  const webhook =
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
    fileEnv.STRIPE_WEBHOOK_SECRET?.trim() ||
    "";
  const legacySecret =
    process.env.STRIPE_SECRET_KEY_LEGACY?.trim() ||
    fileEnv.STRIPE_SECRET_KEY_LEGACY?.trim() ||
    "";
  const legacyWebhook =
    process.env.STRIPE_WEBHOOK_SECRET_LEGACY?.trim() ||
    fileEnv.STRIPE_WEBHOOK_SECRET_LEGACY?.trim() ||
    "";

  console.log("Train Station — wire Jeremy master Stripe\n");
  console.log(`Env file: ${ENV_FILE} ${existsSync(ENV_FILE) ? "(found)" : "(missing)"}`);
  console.log(`Secret:      ${mask(secret)}`);
  console.log(`Publishable: ${mask(publishable)}`);
  console.log(`Webhook:     ${mask(webhook)}`);
  console.log(`Legacy sk:   ${mask(legacySecret)}`);
  console.log(`Legacy wh:   ${mask(legacyWebhook)}`);

  if (!secret) {
    console.error(`
Missing Jeremy Live secret key.

Create ${ENV_FILE} (do not commit) with:
  STRIPE_SECRET_KEY=sk_live_...
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...   # optional until webhook created

Then re-run:
  node scripts/wire-jeremy-master-stripe.mjs --identify
  node scripts/wire-jeremy-master-stripe.mjs --push-vercel
`);
    process.exit(1);
  }

  if (!secret.includes("live")) {
    console.error("Refusing: secret is not a Live key (expected sk_live_ / rk_live_ / rkcs_live).");
    process.exit(1);
  }

  const acct = await stripeGet("/account", secret);
  const bp = acct.business_profile || {};
  const dash = acct.settings?.dashboard || {};
  console.log("\n=== Stripe account (from secret) ===");
  console.log(`  id:               ${acct.id}`);
  console.log(`  email:            ${acct.email || "(none)"}`);
  console.log(`  business name:    ${bp.name || "(none)"}`);
  console.log(`  dashboard name:   ${dash.display_name || "(none)"}`);
  console.log(`  charges_enabled:  ${acct.charges_enabled}`);
  console.log(`  payouts_enabled:  ${acct.payouts_enabled}`);
  console.log(`  country:          ${acct.country}`);

  if (EXPECTED_HINTS.includes(acct.id)) {
    console.log("  ✓ Matches documented Jeremy Live account (CONTEXT.md).");
  } else {
    console.log(
      "  ⚠ Does not match documented acct_1TmKSWQWWnajU9uyk — confirm this IS Jeremy’s Train Station business before pushing.",
    );
  }

  if (publishable) {
    const livePk = publishable.startsWith("pk_live_");
    console.log(`\nPublishable live? ${livePk ? "yes" : "NO — fix before prod"}`);
    // soft check: classic key embeds account fragment
    const frag = acct.id.replace(/^acct_1/, "");
    if (livePk && !publishable.includes(frag.slice(0, 10))) {
      console.log(
        "  ⚠ Publishable key does not look like it belongs to this account id. Double-check paste.",
      );
    }
  } else {
    console.log("\nPublishable key missing — required for Checkout.");
  }

  // Catalog readiness (membership prices already on account?)
  const products = await stripeGet("/products?limit=20&active=true", secret);
  console.log("\n=== Active products (first page) ===");
  for (const p of products.data || []) {
    console.log(`  ${p.id}  ${p.name}`);
  }

  if (identifyOnly && !push) {
    console.log(`
Next:
  1. Confirm the account above is Jeremy’s Train Station (not Eco Delight / not John’s personal).
  2. Create Live webhook → https://www.thetrainstation.co/api/stripe/webhook
  3. Put Jeremy whsec_… in .env.jeremy.live as STRIPE_WEBHOOK_SECRET
  4. Copy CURRENT Production Eco keys into the same file as:
       STRIPE_SECRET_KEY_LEGACY=sk_live_…   # today’s Eco STRIPE_SECRET_KEY
       STRIPE_WEBHOOK_SECRET_LEGACY=whsec_… # today’s Eco STRIPE_WEBHOOK_SECRET
     (Vercel → train-station → Settings → Environment Variables → Production)
  5. node scripts/wire-jeremy-master-stripe.mjs --push-vercel
  6. Redeploy Production
  7. node scripts/stripe-live-status.mjs  (expect pk prefix NOT 51SuLDr)
  8. $25 smoke on a fresh email; Ali/Bella stay Continue already paid
  9. ONLY THEN wire John’s Connect for commission (Admin → Dev & partnership)
`);
    return;
  }

  if (!publishable?.startsWith("pk_live_")) {
    console.error("Cannot push: need NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…");
    process.exit(1);
  }

  console.log("\n=== Pushing to Vercel Production (sensitive) ===");
  vercelEnvSet("STRIPE_SECRET_KEY", secret, "production");
  vercelEnvSet("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", publishable, "production");
  if (webhook.startsWith("whsec_")) {
    vercelEnvSet("STRIPE_WEBHOOK_SECRET", webhook, "production");
  } else {
    console.log("  · STRIPE_WEBHOOK_SECRET skipped (set when you have Live whsec_)");
  }
  if (legacySecret.includes("live")) {
    vercelEnvSet("STRIPE_SECRET_KEY_LEGACY", legacySecret, "production");
  } else {
    console.log(
      "  ⚠ STRIPE_SECRET_KEY_LEGACY missing — Eco leftover subs (Ali/Bella/Jeremy2) will not retrieve after swap.",
    );
  }
  if (legacyWebhook.startsWith("whsec_")) {
    vercelEnvSet("STRIPE_WEBHOOK_SECRET_LEGACY", legacyWebhook, "production");
  } else {
    console.log(
      "  ⚠ STRIPE_WEBHOOK_SECRET_LEGACY missing — Eco invoice.paid will 400 after swap.",
    );
  }

  // Price IDs if provided in env file
  for (const k of [
    "STRIPE_PRICE_MEMBER",
    "STRIPE_PRICE_BUSINESS",
    "STRIPE_PRICE_PRO",
    "STRIPE_PRICE_TIP_5",
    "STRIPE_PRICE_TIP_10",
    "STRIPE_PRICE_TIP_25",
    "STRIPE_PRICE_TIP_50",
    "STRIPE_PRICE_TIP_CUSTOM",
  ]) {
    const v = fileEnv[k]?.trim() || process.env[k]?.trim();
    if (v?.startsWith("price_")) {
      vercelEnvSet(k, v, "production");
    }
  }

  console.log(`
Done writing master keys for account ${acct.id}.

Still required:
  • Redeploy Production (vercel --prod or push to main)
  • If STRIPE_PRICE_* not set: POST /api/admin/ops/stripe-bootstrap with OPS_BOOTSTRAP_SECRET,
    then put returned price_… into Vercel and redeploy again
  • Live webhook events + 200 delivery
  • $25 smoke charge (refund OK)
  • John commission Connect AFTER master is proven (do not reverse order)
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
