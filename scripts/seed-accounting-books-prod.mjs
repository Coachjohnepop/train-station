#!/usr/bin/env node
/**
 * Seed Train Station accounting entity + chart of accounts on prod Postgres.
 * Optionally backfill GL journals from FactSubscriptionPayment.
 *
 *   node scripts/seed-accounting-books-prod.mjs
 *   BACKFILL=1 node scripts/seed-accounting-books-prod.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.vercel.production" });
dotenv.config({ path: ".env.vercel.prod" });

import { createPgPool } from "../src/lib/pg-connection.ts";
import { randomBytes } from "crypto";

const BACKFILL = process.env.BACKFILL === "1";
const url =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "";

if (!url) {
  console.error("Need Postgres URL");
  process.exit(1);
}

function cuidish() {
  return `c${Date.now().toString(36)}${randomBytes(6).toString("hex")}`;
}

const CHART = [
  ["1000", "Cash — Stripe clearing", "ASSET", "bank", "DEBIT", 100],
  ["1010", "Cash — Venmo / undeposited", "ASSET", "bank", "DEBIT", 110],
  ["1100", "Accounts receivable", "ASSET", "ar", "DEBIT", 200],
  ["1200", "Stripe fees receivable / adjustments", "ASSET", "other_current", "DEBIT", 210],
  ["2000", "Deferred membership revenue", "LIABILITY", "deferred_revenue", "CREDIT", 300],
  ["2100", "Partner fee pool payable", "LIABILITY", "payable", "CREDIT", 310],
  ["2200", "Sales tax payable", "LIABILITY", "tax", "CREDIT", 320],
  ["3000", "Owner equity", "EQUITY", "equity", "CREDIT", 400],
  ["3100", "Retained earnings", "EQUITY", "retained_earnings", "CREDIT", 410],
  ["4000", "Membership revenue", "REVENUE", "membership", "CREDIT", 500],
  ["4010", "Tips revenue", "REVENUE", "tips", "CREDIT", 510],
  ["4020", "Merchandise / other revenue", "REVENUE", "other", "CREDIT", 520],
  ["5000", "Stripe processing fees", "EXPENSE", "payment_fees", "DEBIT", 600],
  ["5100", "Platform / partnership fees", "EXPENSE", "platform", "DEBIT", 610],
  ["5200", "Refunds & chargebacks", "EXPENSE", "refunds", "DEBIT", 620],
  ["6000", "Operating expenses", "EXPENSE", "opex", "DEBIT", 700],
];

const pool = createPgPool(url);

async function main() {
  const now = new Date();

  let entityId;
  const { rows: entities } = await pool.query(
    `SELECT id FROM "AcctEntity" WHERE code = 'train-station' LIMIT 1`,
  );
  if (entities[0]) {
    entityId = entities[0].id;
    console.log("Entity exists", entityId);
  } else {
    entityId = cuidish();
    await pool.query(
      `INSERT INTO "AcctEntity" (id, code, name, "legalName", currency, "fiscalYearStartMonth", "isActive", "createdAt", "updatedAt")
       VALUES ($1, 'train-station', 'The Train Station', 'The Train Station', 'usd', 1, true, $2, $2)`,
      [entityId, now],
    );
    console.log("Created entity", entityId);
  }

  for (const [code, name, type, subtype, normal, sort] of CHART) {
    const { rows } = await pool.query(
      `SELECT id FROM "AcctAccount" WHERE "entityId" = $1 AND code = $2`,
      [entityId, code],
    );
    if (rows[0]) continue;
    await pool.query(
      `INSERT INTO "AcctAccount" (
         id, "entityId", code, name, type, subtype, "normalBalance",
         description, "isActive", "isSystem", "sortOrder", "createdAt", "updatedAt"
       ) VALUES ($1,$2,$3,$4,$5::"AcctAccountType",$6,$7::"AcctNormalBalance",$8,true,true,$9,$10,$10)`,
      [cuidish(), entityId, code, name, type, subtype, normal, name, sort, now],
    );
    console.log("  + account", code, name);
  }

  const { rows: acctCount } = await pool.query(
    `SELECT count(*)::int AS n FROM "AcctAccount" WHERE "entityId" = $1`,
    [entityId],
  );
  console.log("Accounts:", acctCount[0].n);

  if (BACKFILL) {
    const { rows: accts } = await pool.query(
      `SELECT id, code FROM "AcctAccount" WHERE "entityId" = $1`,
      [entityId],
    );
    const acctByCode = Object.fromEntries(accts.map((a) => [a.code, a.id]));

    const { rows: facts } = await pool.query(
      `SELECT f.*, u.name AS user_name, u.email AS user_email
       FROM "FactSubscriptionPayment" f
       LEFT JOIN "User" u ON u.id = f."userId"
       WHERE f.status = 'paid' AND f."amountCents" > 0
       ORDER BY f."paidAt" ASC`,
    );
    console.log("Backfilling", facts.length, "facts");

    let created = 0;
    let skipped = 0;
    for (const f of facts) {
      const { rows: existing } = await pool.query(
        `SELECT id FROM "AcctJournalEntry"
         WHERE "sourceSystem" IN ('STRIPE','VENMO','MANUAL')
           AND "sourceType" = 'FactSubscriptionPayment'
           AND "sourceId" = $1`,
        [f.id],
      );
      if (existing[0]) {
        skipped += 1;
        continue;
      }

      const reason = (f.billingReason || "").toLowerCase();
      const props = f.properties || {};
      const method = String(props.method || (reason.includes("venmo") ? "venmo" : "stripe"));
      const isTip = reason.includes("tip") || f.planId === "coach_tip";
      const isVenmo = method === "venmo" || reason.includes("venmo");
      const isManual = method === "manual" || reason.includes("admin_mark");

      let cashCode = "1000";
      let sourceSystem = "STRIPE";
      if (isVenmo) {
        cashCode = "1010";
        sourceSystem = "VENMO";
      } else if (isManual && !isTip) {
        cashCode = "1010";
        sourceSystem = "MANUAL";
      }
      let revCode = "4000";
      if (isTip) revCode = "4010";
      else if (f.planId === "merchandise") revCode = "4020";

      const cashId = acctByCode[cashCode];
      const revId = acctByCode[revCode];
      if (!cashId || !revId) {
        console.warn("missing accounts", cashCode, revCode);
        continue;
      }

      // party
      let partyId = null;
      if (f.userId) {
        const { rows: parties } = await pool.query(
          `SELECT id FROM "AcctParty" WHERE "entityId" = $1 AND "userId" = $2 AND kind = 'CUSTOMER'`,
          [entityId, f.userId],
        );
        if (parties[0]) partyId = parties[0].id;
        else {
          partyId = cuidish();
          await pool.query(
            `INSERT INTO "AcctParty" (id, "entityId", kind, name, email, "userId", "stripeCustomerId", "isActive", "createdAt", "updatedAt")
             VALUES ($1,$2,'CUSTOMER',$3,$4,$5,$6,true,$7,$7)`,
            [
              partyId,
              entityId,
              f.user_name || f.user_email || f.userId,
              f.user_email,
              f.userId,
              f.stripeCustomerId,
              now,
            ],
          );
        }
      }

      const { rows: jeCount } = await pool.query(
        `SELECT count(*)::int AS n FROM "AcctJournalEntry" WHERE "entityId" = $1`,
        [entityId],
      );
      const entryNumber = `JE-${String(jeCount[0].n + 1).padStart(5, "0")}`;
      const entryId = cuidish();
      const entryDate = f.paidAt;

      await pool.query(
        `INSERT INTO "AcctJournalEntry" (
           id, "entityId", "entryNumber", "entryDate", status, memo,
           "sourceSystem", "sourceType", "sourceId", currency, "postedAt", "createdAt", "updatedAt"
         ) VALUES (
           $1,$2,$3,$4::date,'POSTED',$5,
           $6::"AcctSourceSystem",'FactSubscriptionPayment',$7,'usd',$8,$8,$8
         )`,
        [
          entryId,
          entityId,
          entryNumber,
          entryDate,
          `Membership · ${f.amountCents}¢`,
          sourceSystem,
          f.id,
          now,
        ],
      );
      await pool.query(
        `INSERT INTO "AcctJournalLine" (id, "entryId", "accountId", "partyId", "lineNo", "debitCents", "creditCents", memo)
         VALUES ($1,$2,$3,$4,1,$5,0,'Cash'), ($6,$2,$7,$4,2,0,$5,'Revenue')`,
        [cuidish(), entryId, cashId, partyId, f.amountCents, cuidish(), revId],
      );
      created += 1;
      console.log("  posted", entryNumber, f.amountCents, f.user_email || f.userId);
    }
    console.log({ created, skipped });
  }

  const { rows: j } = await pool.query(`SELECT count(*)::int AS n FROM "AcctJournalEntry"`);
  const { rows: l } = await pool.query(`SELECT count(*)::int AS n FROM "AcctJournalLine"`);
  console.log("Totals", { journals: j[0].n, lines: l[0].n });
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
