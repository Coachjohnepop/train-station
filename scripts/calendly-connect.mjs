#!/usr/bin/env node
/**
 * Probe Calendly API + optionally sync a member's invitee (reschedule URL).
 *
 *   CALENDLY_API_TOKEN=... npx tsx scripts/calendly-connect.mjs
 *   EMAIL=tangledsigns@gmail.com npx tsx scripts/calendly-connect.mjs
 *
 * Token: Calendly → Integrations & apps → API & webhooks → Personal access tokens
 * (Jeremy's account). Then vercel env add CALENDLY_API_TOKEN production
 */
import dotenv from "dotenv";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.go-prod" });
dotenv.config({ path: ".env" });

const {
  calendlyApiToken,
  getCalendlyMe,
  listCalendlyWebhookSubscriptions,
  findCalendlyInviteeByEmail,
  syncCalendlyBookingForEmail,
} = await import("../src/lib/calendly-invitee.ts");

const email = (process.env.EMAIL || "").trim().toLowerCase();

if (!calendlyApiToken()) {
  console.error("CALENDLY_API_TOKEN is not set.");
  console.error(
    "Create one: https://calendly.com/integrations/api_webhooks → Personal access tokens",
  );
  console.error("Then: echo TOKEN | vercel env add CALENDLY_API_TOKEN production");
  process.exit(1);
}

const me = await getCalendlyMe();
console.log("me", me ? { email: me.email, name: me.name } : null);

const hooks = await listCalendlyWebhookSubscriptions();
console.log(
  "webhooks",
  hooks.map((h) => ({ url: h.callbackUrl, state: h.state, events: h.events })),
);

if (email) {
  const found = await findCalendlyInviteeByEmail(email);
  console.log("invitee", found);
  const synced = await syncCalendlyBookingForEmail(email);
  console.log("sync", synced);
}
