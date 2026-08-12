#!/usr/bin/env node
/**
 * Rescue Ali Fletcher (fletcherboys@att.net) on production.
 *
 * - Confirms paid Coach Class stamp
 * - Sets coaching mode to **async** (on-demand only — no live Zoom classes)
 * - Leaves a coach note for Jeremy
 * - Does NOT force onboarding complete (she finishes setup on her phone)
 *
 * Usage (from repo root):
 *   node scripts/rescue-ali-fletcher-prod.mjs
 *   DRY_RUN=1 node scripts/rescue-ali-fletcher-prod.mjs
 *
 * Loads env from .env.vercel.production (or POSTGRES_* already in env).
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.vercel.production" });
dotenv.config({ path: ".env.vercel.prod" });

import { createPgPool } from "../src/lib/pg-connection.ts";

const EMAIL = (process.env.EMAIL || "fletcherboys@att.net").trim().toLowerCase();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const NOTE =
  "On-demand only (async) — no live Zoom sessions. Paid Coach Class 2026-08-10. Rescued after sticky payment gate.";

const url =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "";

if (!url || url.includes("dummy")) {
  console.error("Need real POSTGRES_PRISMA_URL / DATABASE_URL from .env.vercel.production");
  process.exit(1);
}

const pool = createPgPool(url);

async function main() {
  const { rows: users } = await pool.query(
    `SELECT id, email, name, phone, "signupPlan", status, "createdAt"
     FROM "User" WHERE lower(email) = $1 LIMIT 1`,
    [EMAIL],
  );
  if (!users.length) {
    console.error(`User not found: ${EMAIL}`);
    process.exit(1);
  }
  const user = users[0];
  console.log("User:", {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    signupPlan: user.signupPlan,
  });

  const { rows: profiles } = await pool.query(
    `SELECT "userId", plan, "paymentStatus", "paymentMethod", "paidAt",
            "onboardingComplete", "approvalStatus", "stripeCustomerId",
            "stripeSubscriptionId", notes
     FROM "MemberProfile" WHERE "userId" = $1`,
    [user.id],
  );
  if (!profiles.length) {
    console.error("MemberProfile missing — cannot rescue.");
    process.exit(1);
  }
  const profile = profiles[0];
  console.log("Profile before:", profile);

  if (profile.paymentStatus !== "paid") {
    console.error(
      `paymentStatus is "${profile.paymentStatus}" — expected paid. Fix payment first (Admin → Mark paid or Stripe).`,
    );
    process.exit(1);
  }

  const { rows: enr } = await pool.query(
    `SELECT pe.id, p.slug, p.name, pe."currentWeek", pe."currentDay", pe."trainingLocation"
     FROM "ProgramEnrollment" pe
     JOIN "Program" p ON p.id = pe."programId"
     WHERE pe."userId" = $1`,
    [user.id],
  );
  console.log("Enrollments:", enr);

  if (DRY_RUN) {
    console.log("\nDRY_RUN=1 — would set coachingMode=async and coach note. No writes.");
    await pool.end();
    return;
  }

  // Coach prefs: on-demand only
  await pool.query(
    `INSERT INTO "MemberCoachPrefs" ("userId", "coachingMode", "alertOverrides", "updatedAt")
     VALUES ($1, 'async', '{}'::jsonb, NOW())
     ON CONFLICT ("userId") DO UPDATE SET
       "coachingMode" = 'async',
       "updatedAt" = NOW()`,
    [user.id],
  );
  console.log("✓ coachingMode = async (on-demand only, no live sessions)");

  // Profile note for Jeremy (append if missing)
  const existingNotes = (profile.notes || "").trim();
  if (!existingNotes.includes("On-demand only")) {
    const nextNotes = existingNotes ? `${existingNotes}\n${NOTE}` : NOTE;
    await pool.query(
      `UPDATE "MemberProfile" SET notes = $2, "updatedAt" = NOW() WHERE "userId" = $1`,
      [user.id, nextNotes],
    );
    console.log("✓ profile notes updated");
  } else {
    console.log("· notes already mark on-demand");
  }

  // User-level note for admin list
  const { rows: uNotes } = await pool.query(`SELECT notes FROM "User" WHERE id = $1`, [user.id]);
  const uNote = (uNotes[0]?.notes || "").trim();
  if (!uNote.includes("on-demand only")) {
    const next = uNote
      ? `${uNote}\nOn-demand only (async coaching) — no live Zoom.`
      : "On-demand only (async coaching) — no live Zoom.";
    await pool.query(`UPDATE "User" SET notes = $2, "updatedAt" = NOW() WHERE id = $1`, [
      user.id,
      next,
    ]);
    console.log("✓ user notes updated");
  }

  const { rows: prefs } = await pool.query(
    `SELECT "coachingMode", "updatedAt" FROM "MemberCoachPrefs" WHERE "userId" = $1`,
    [user.id],
  );
  console.log("\nCoach prefs after:", prefs[0]);
  console.log("\nNext for Ali (phone):");
  console.log("  1. Open https://www.thetrainstation.co and sign in");
  console.log("  2. Hard-refresh if still on checkout (cookies re-sync on member pages)");
  console.log("  3. Finish /member/onboard setup (she is already PAID)");
  console.log("  4. Use Today for workouts — Live Class is not her path (async/on-demand)");
  console.log("\nDone.");
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
