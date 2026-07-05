#!/usr/bin/env node
/**
 * Email catalog + prescription example CSVs for coach review.
 *
 * Usage:
 *   EXPORT_TO=jeremy@thetrainstation.co node scripts/email-csv-review.mjs
 */

import { readFileSync } from "node:fs";

const EXPORT_TO = process.env.EXPORT_TO || "jeremy@thetrainstation.co";
const CC = process.env.CC_TO || "";

function loadEnvKey(name) {
  for (const file of [".env.local", ".env.vercel.production"]) {
    try {
      const raw = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      const m = raw.match(new RegExp(`^${name}="([^"]*)"`, "m"));
      if (m?.[1]) return m[1];
    } catch {
      /* skip */
    }
  }
  return process.env[name] || "";
}

function attach(path, filename) {
  const content = readFileSync(new URL(`../${path}`, import.meta.url));
  return {
    filename,
    content: content.toString("base64"),
  };
}

async function main() {
  const apiKey = loadEnvKey("RESEND_API_KEY");
  const from =
    loadEnvKey("LEAD_NOTIFY_FROM") ||
    loadEnvKey("RESEND_FROM") ||
    "Train Station <accounts@send.thetrainstation.co>";

  if (!apiKey) {
    console.error("RESEND_API_KEY missing");
    process.exit(1);
  }

  const text = [
    "Hi Jeremy,",
    "",
    "Two CSV files are attached for your review:",
    "",
    "1. exercise-catalog.csv — 96 standardized exercise names (movement only, no reps/sets in names)",
    "2. workout-prescription-examples.csv — 80 sample prescriptions (10 per pattern type)",
    "",
    "Prescription patterns covered:",
    "  • standard_reps — e.g. 10 sets × 10 reps",
    "  • hold_burnout — e.g. 20s hold → burnout (log highest rep count)",
    "  • hold_fixed_reps — e.g. 30s hold → 5 reps",
    "  • timed_rounds — e.g. 8 rounds × 20s on (HIIT)",
    "  • burnout_only, hold_only, hold_then_timed, max_reps",
    "",
    "Key design rule: exercise name = what it is. Sets, reps, holds, rest between sets",
    "all live in workout data (not the exercise catalog).",
    "",
    "Caps in examples: max 10 sets, max 30 reps.",
    "",
    "Reply with any renames, missing exercises, or prescription tweaks.",
    "",
    "— Train Station",
  ].join("\n");

  const payload = {
    from,
    to: [EXPORT_TO],
    subject: "Train Station — exercise catalog & workout prescription CSVs for review",
    text,
    attachments: [
      attach("exports/exercise-catalog.csv", "exercise-catalog.csv"),
      attach(
        "exports/workout-prescription-examples.csv",
        "workout-prescription-examples.csv",
      ),
    ],
  };

  if (CC) payload.cc = [CC];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error("Email failed:", res.status, (await res.text()).slice(0, 300));
    process.exit(1);
  }

  console.log(`✅ Sent CSV review package to ${EXPORT_TO}`);
  if (CC) console.log(`   CC: ${CC}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});