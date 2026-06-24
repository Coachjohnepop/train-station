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
  console.log("\n✗ Missing records. In Resend (resend.com/domains) open", subdomain);
  console.log("  Copy the 3 records into Porkbun → thetrainstation.co → DNS:");
  console.log("    MX   host: send              priority 10");
  console.log("    TXT  host: send              (SPF — v=spf1 include:amazonses.com ~all)");
  console.log("    TXT  host: resend._domainkey  (DKIM — unique per domain, copy from Resend)");
  console.log("  Optional DMARC: TXT host _dmarc.send  v=DMARC1; p=none;");
  console.log("  Then Verify DNS in Resend and run: vercel env add RESEND_FROM production");
  console.log('    value: The Train Station <notifications@' + subdomain + ">");
}