/**
 * Create John (/commit) and Jeremy (/discipline) as affiliates at 5%
 * for the first 6 months of each referred membership, and attach an
 * existing Stripe Connect account when one can receive transfers.
 *
 *   node --env-file=.env.vercel.production scripts/seed-founder-affiliates.mjs
 *
 * Does not print secret keys or full account ids.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import Stripe from "stripe";

const ROOT = resolve(import.meta.dirname, "..");

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function dbUrl() {
  return (
    process.env.DIRECT_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    ""
  );
}

const FOUNDERS = [
  {
    email: "john@thetrainstation.co",
    fallbackName: "John Popham",
    code: "COMMIT",
    path: "commit",
    also: ["john@lemonvoice.com", "john@bcxvoice.com"],
  },
  {
    email: "jeremy@thetrainstation.co",
    fallbackName: "Jeremy",
    code: "DISCIPLINE",
    path: "discipline",
    also: ["jeremy@thetrainstation.co"],
  },
];

async function ensureSchema(client) {
  const files = [
    "20260924120000_affiliate_program",
    "20260924140000_affiliate_stripe_connect",
    "20260924160000_affiliate_promotions_reserve",
    "20260924180000_affiliate_founders",
  ];
  for (const name of files) {
    const sql = readFileSync(resolve(ROOT, "prisma/migrations", name, "migration.sql"), "utf8");
    await client.query(sql);
  }
}

async function connectedAccounts(stripe) {
  const rows = [];
  let startingAfter;
  for (let page = 0; page < 5; page++) {
    const list = await stripe.accounts.list({ limit: 100, starting_after: startingAfter });
    for (const account of list.data) {
      rows.push(account);
    }
    if (!list.has_more) break;
    startingAfter = list.data[list.data.length - 1]?.id;
  }
  return rows;
}

function accountReady(account) {
  return Boolean(account.payouts_enabled) || account.capabilities?.transfers === "active";
}

function matchAccount(accounts, emails) {
  const wanted = new Set(emails.map((email) => email.toLowerCase()));
  return accounts.find((account) => wanted.has((account.email || "").toLowerCase()) && accountReady(account))
    || accounts.find((account) => wanted.has((account.email || "").toLowerCase()));
}

if (!process.env.STRIPE_SECRET_KEY?.trim()) {
  try {
    const raw = readFileSync(resolve(ROOT, ".env.jeremy.live"), "utf8");
    const line = raw.split("\n").find((row) => row.startsWith("STRIPE_SECRET_KEY="));
    const value = line?.slice("STRIPE_SECRET_KEY=".length).replace(/^"|"$/g, "").trim();
    if (value) process.env.STRIPE_SECRET_KEY = value;
  } catch {
    /* Stripe stays unwired if the live env file is absent. */
  }
}

const url = dbUrl();
if (!url) {
  console.error("No database URL in the environment.");
  process.exit(1);
}

const cleaned = url.replace(/([?&])sslmode=[^&]*/g, "$1").replace(/[?&]$/, "");
const client = new pg.Client({
  connectionString: cleaned,
  ssl: /supabase\.co|amazonaws\.com/i.test(url) ? { rejectUnauthorized: false } : undefined,
});
await client.connect();
try {
  await ensureSchema(client);

  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  const stripe = stripeKey ? new Stripe(stripeKey) : null;
  const accounts = stripe ? await connectedAccounts(stripe) : [];
  const partners = await client.query(
    `SELECT email, "stripeAccountId" FROM "CommissionPartner" WHERE "stripeAccountId" IS NOT NULL`,
  );

  for (const founder of FOUNDERS) {
    const user = await client.query(
      `SELECT name, email FROM "User" WHERE lower(email) = lower($1) LIMIT 1`,
      [founder.email],
    );
    const name = user.rows[0]?.name?.trim() || founder.fallbackName;
    const partner = partners.rows.find((row) => (row.email || "").toLowerCase() === founder.email);
    const matched = matchAccount(accounts, [founder.email, ...founder.also]);
    let stripeAccountId = matched?.id || partner?.stripeAccountId || null;
    let stripeOnboarded = matched ? accountReady(matched) : false;
    let onboardingUrl = "";
    if (!stripeAccountId && stripe) {
      try {
        const account = await stripe.accounts.create({
          type: "express",
          country: "US",
          email: founder.email,
          capabilities: { transfers: { requested: true } },
          business_profile: {
            name,
            url: "https://www.thetrainstation.co",
            product_description: "The Train Station affiliate commissions",
          },
          metadata: {
            role: "affiliate",
            product: "train-station",
            referral_code: founder.code,
          },
        });
        stripeAccountId = account.id;
        stripeOnboarded = accountReady(account);
        const link = await stripe.accountLinks.create({
          account: account.id,
          type: "account_onboarding",
          refresh_url: "https://www.thetrainstation.co/affiliate?stripe=refresh",
          return_url: "https://www.thetrainstation.co/affiliate?stripe=return",
        });
        onboardingUrl = link.url || "";
      } catch (error) {
        console.log(`${founder.path} stripe connect: ${error instanceof Error ? error.message : "could not create"}`);
      }
    }
    const existing = await client.query(`SELECT id FROM "Affiliate" WHERE email = $1 OR "referralCode" = $2`, [
      founder.email,
      founder.code,
    ]);
    if (existing.rows[0]) {
      await client.query(
        `UPDATE "Affiliate"
         SET name = $2, "referralCode" = $3, "vanityPath" = $4, "commissionRate" = 0.05,
             "commissionMonths" = 6, status = 'ACTIVE',
             "stripeAccountId" = COALESCE($5, "stripeAccountId"),
             "stripeOnboarded" = CASE WHEN $5::text IS NULL THEN "stripeOnboarded" ELSE $6 END,
             "updatedAt" = NOW()
         WHERE id = $1`,
        [existing.rows[0].id, name, founder.code, founder.path, stripeAccountId, stripeOnboarded],
      );
    } else {
      await client.query(
        `INSERT INTO "Affiliate"
          (id, email, name, "passwordHash", "referralCode", "vanityPath", "commissionRate", "commissionMonths",
           status, "stripeAccountId", "stripeOnboarded", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, 0.05, 6, 'ACTIVE', $7, $8, NOW())`,
        [
          `aff_${founder.path}`,
          founder.email,
          name,
          hashPassword(randomBytes(24).toString("base64url")),
          founder.code,
          founder.path,
          stripeAccountId,
          stripeOnboarded,
        ],
      );
    }
    console.log(
      `${name} <${founder.email}> /${founder.path} 5% for 6 months · stripe ${stripeOnboarded ? "connected" : stripeAccountId ? "onboarding ready" : "not found"}`,
    );
    if (onboardingUrl) console.log(`  finish Stripe: ${onboardingUrl}`);
  }
} finally {
  await client.end();
}
