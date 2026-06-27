#!/usr/bin/env node
/**
 * Wipe the demo signup email after each Vercel production build.
 * Disable with DEMO_RESET_ON_BUILD=false when checkout is stable.
 *
 * Override email: DEMO_RESET_EMAIL=you+test@example.com
 */
import { removeMemberByEmail } from "./remove-member-email.mjs";

const DEFAULT_EMAIL = "john+test@lemonvoice.com";

async function main() {
  if (process.env.VERCEL_ENV !== "production") {
    console.log("[demo-reset] skip — not a production build");
    return;
  }

  if (process.env.DEMO_RESET_ON_BUILD === "false") {
    console.log("[demo-reset] skip — DEMO_RESET_ON_BUILD=false");
    return;
  }

  const email = (process.env.DEMO_RESET_EMAIL || DEFAULT_EMAIL).trim().toLowerCase();
  console.log(`[demo-reset] clearing ${email} after production build…`);

  try {
    const result = await removeMemberByEmail(email);
    if (!result.accountRemoved && result.profilesRemoved === 0 && result.waitlistRemoved === 0) {
      console.log(`[demo-reset] nothing to remove for ${email}`);
      return;
    }

    const parts = [];
    if (result.accountRemoved) parts.push("account");
    if (result.profilesRemoved) parts.push(`${result.profilesRemoved} profile(s)`);
    if (result.waitlistRemoved) parts.push(`${result.waitlistRemoved} waitlist row(s)`);
    console.log(`[demo-reset] cleared ${email}: ${parts.join(", ")}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`[demo-reset] failed (build continues): ${message}`);
  }
}

main();