#!/usr/bin/env node
/**
 * Treat an email as an existing member and reset them into fresh onboarding
 * (keeps or creates the account — no signup flow required).
 *
 * Usage:
 *   node scripts/reprovision-member-onboard-prod.mjs john@lemonvoice.com 'YourPass123!'
 *   node scripts/reprovision-member-onboard-prod.mjs john@lemonvoice.com   # keeps existing password
 */
import { randomBytes, randomUUID, scryptSync } from "crypto";
import { blobOptions } from "./remove-member-email.mjs";

const ACCOUNTS_PATH = "demo/registered-accounts.json";
const PROFILES_PATH = "demo/member-profiles.json";
const QUICK_AUTH_PATH = "demo/quick-auth-devices.json";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function readJson(path) {
  const opts = blobOptions();
  const { head } = await import("@vercel/blob");
  const meta = await head(path, opts);
  const res = await fetch(`${meta.url}?_ts=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`read ${path}: ${res.status}`);
  return res.json();
}

async function writeJson(path, data) {
  const { put } = await import("@vercel/blob");
  await put(path, JSON.stringify(data, null, 2), {
    ...blobOptions(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

function freshExplorerProfile(userId, email) {
  const now = new Date().toISOString();
  return {
    userId,
    email,
    plan: "explorer",
    phone: null,
    dailyReminderTime: null,
    weightLbs: null,
    notes: null,
    city: null,
    state: null,
    onboardingComplete: false,
    completedAt: null,
    approvalStatus: "approved",
    approvedAt: now,
    paymentStatus: "none",
    paidAt: null,
    paymentMethod: null,
    paymentNote: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeCheckoutSessionId: null,
    referralCode: null,
    referredByUserId: null,
    intensiveSessionsTotal: null,
    intensiveSessionsRemaining: null,
    intensiveWindowDays: null,
    intensiveStartsAt: null,
    intensiveExpiresAt: null,
    customTrainingOfferId: null,
    welcomeSignupEmailSentAt: null,
    welcomeCompleteEmailSentAt: null,
    welcomeSmsSentAt: null,
    coachIntakeCompleteAt: null,
    coachIntakeCompletedBy: null,
    introBookedAt: null,
    coachMeetingRequestedAt: null,
    coachMeetingRequestedBy: null,
    coachMeetingRequestNote: null,
    rampStartedAt: null,
    updatedAt: now,
  };
}

async function purgeQuickAuth(email) {
  const normalized = email.trim().toLowerCase();
  const store = await readJson(QUICK_AUTH_PATH);
  let removed = 0;
  for (const [key, entry] of Object.entries(store)) {
    const entryEmail = entry?.email?.toLowerCase?.();
    if (key === `_preset:${normalized}` || entryEmail === normalized) {
      delete store[key];
      removed += 1;
    }
  }
  if (removed > 0) await writeJson(QUICK_AUTH_PATH, store);
  return removed;
}

export async function reprovisionMemberForOnboarding(email, options = {}) {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) throw new Error("Valid email required.");

  const accounts = await readJson(ACCOUNTS_PATH);
  const existing = accounts[normalized];
  const userId = existing?.userId || `member-${randomUUID().slice(0, 12)}`;
  const name = options.name || existing?.name || "John Test";

  accounts[normalized] = {
    userId,
    role: "MEMBER",
    name,
    phone: existing?.phone ?? null,
    passwordHash:
      options.password && options.password.length >= 8
        ? hashPassword(options.password)
        : existing?.passwordHash ?? null,
    hidden: false,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  await writeJson(ACCOUNTS_PATH, accounts);

  const profiles = await readJson(PROFILES_PATH);
  profiles[userId] = freshExplorerProfile(userId, normalized);
  await writeJson(PROFILES_PATH, profiles);

  const quickAuthRemoved = await purgeQuickAuth(normalized);

  return {
    email: normalized,
    userId,
    name,
    plan: "explorer",
    onboardingComplete: false,
    passwordSet: Boolean(accounts[normalized].passwordHash),
    quickAuthRemoved,
    signInUrl: "https://www.thetrainstation.co/login",
    onboardUrl: `https://www.thetrainstation.co/member/onboard?plan=explorer`,
  };
}

const emailArg = process.argv[2]?.trim();
const passwordArg = process.argv[3];

if (!emailArg) {
  console.error("Usage: node scripts/reprovision-member-onboard-prod.mjs <email> [password]");
  process.exit(1);
}

try {
  console.log(`Reprovisioning ${emailArg} for fresh onboarding on production...\n`);
  const result = await reprovisionMemberForOnboarding(emailArg, { password: passwordArg });
  console.log(JSON.stringify(result, null, 2));
  console.log("\nSign in at /login — you should land on onboarding, not signup.");
  if (!result.passwordSet) {
    console.log("No password on file — pass a password as the 2nd arg or use Forgot password.");
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}