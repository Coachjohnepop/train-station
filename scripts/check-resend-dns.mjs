#!/usr/bin/env node
/**
 * Check DNS records for Resend on send.thetrainstation.co (or RESEND_DOMAIN env).
 * Usage: RESEND_DOMAIN=send.thetrainstation.co node scripts/check-resend-dns.mjs
 */

import { execSync } from "child_process";

const subdomain = process.env.RESEND_DOMAIN || "send.thetrainstation.co";

function dig(name, type = "TXT") {
  try {
    return execSync(`dig +short ${type} ${name}`, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

console.log(`Checking Resend DNS for ${subdomain}...\n`);

const spf = dig(subdomain, "TXT");
const dkim = dig(`resend._domainkey.${subdomain}`, "TXT");
const dmarc = dig(`_dmarc.${subdomain}`, "TXT");
const mx = dig(subdomain, "MX");

console.log("SPF/TXT @", subdomain, ":", spf || "(missing)");
console.log("DKIM resend._domainkey:", dkim ? `${dkim.slice(0, 60)}…` : "(missing)");
console.log("DMARC _dmarc:", dmarc || "(optional — recommended)");
console.log("MX:", mx || "(missing)");

if (spf && dkim) {
  console.log("\n✓ Core records found. Click Verify in Resend dashboard, then set Vercel:");
  console.log('  RESEND_FROM="The Train Station <notifications@' + subdomain + '>"');
} else {
  console.log("\n✗ Add domain at https://resend.com/domains → copy records → Porkbun DNS for", subdomain);
}