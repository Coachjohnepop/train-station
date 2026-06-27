#!/usr/bin/env node
/**
 * Remove a single self-registered member from production blob storage.
 *
 * Usage:
 *   node scripts/remove-member-prod.mjs john+test@lemonvoice.com
 */
import { removeMemberByEmail } from "./remove-member-email.mjs";

const emailArg = process.argv[2]?.trim().toLowerCase();
if (!emailArg) {
  console.error("Usage: node scripts/remove-member-prod.mjs <email>");
  process.exit(1);
}

try {
  const result = await removeMemberByEmail(emailArg);
  if (!result.accountRemoved && result.profilesRemoved === 0 && result.waitlistRemoved === 0) {
    console.log(`No data found for ${emailArg}`);
    process.exit(0);
  }

  console.log(`Removing ${emailArg}${result.userId ? ` (${result.userId})` : ""}...`);
  if (result.accountRemoved) console.log("✓ registered-accounts.json");
  if (result.profilesRemoved) console.log(`✓ member-profiles.json (${result.profilesRemoved} row(s))`);
  if (result.waitlistRemoved) console.log("✓ waitlist.json");
  console.log("\nDone. They can sign up fresh with that email.");
} catch (e) {
  console.error(e);
  process.exit(1);
}