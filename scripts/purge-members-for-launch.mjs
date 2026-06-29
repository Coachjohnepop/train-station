#!/usr/bin/env node
/**
 * Production launch purge — keep only staff admin accounts and wipe member data.
 *
 * Usage:
 *   node scripts/purge-members-for-launch.mjs
 *   node scripts/purge-members-for-launch.mjs --dry-run
 */
import { blobOptions } from "./remove-member-email.mjs";
import { fullyResetMemberByEmail } from "./reset-member-full-prod.mjs";
import { head, put } from "@vercel/blob";

const STAFF_EMAILS = new Set([
  "jeremy@thetrainstation.co",
  "john@thetrainstation.co",
]);

const STAFF_USER_IDS = new Set(["demo-coach-jeremy", "demo-coach-john"]);

const DRY_RUN = process.argv.includes("--dry-run");

async function readJson(path) {
  const opts = blobOptions();
  const meta = await head(path, opts);
  const res = await fetch(`${meta.url}?_ts=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`read ${path}: ${res.status}`);
  return res.json();
}

async function writeJson(path, data) {
  if (DRY_RUN) {
    console.log(`[dry-run] would write ${path}`);
    return;
  }
  await put(path, JSON.stringify(data, null, 2), {
    ...blobOptions(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function readJsonOptional(path, fallback) {
  try {
    return await readJson(path);
  } catch {
    return fallback;
  }
}

function isStaffUserId(userId) {
  return STAFF_USER_IDS.has(userId);
}

async function collectEmailsToPurge() {
  const accounts = await readJson("demo/registered-accounts.json");
  const profiles = await readJson("demo/member-profiles.json");
  const waitlist = await readJsonOptional("demo/waitlist.json", { entries: [] });

  const emails = new Set();
  for (const email of Object.keys(accounts)) {
    if (!STAFF_EMAILS.has(email)) emails.add(email);
  }
  for (const profile of Object.values(profiles)) {
    const email = profile?.email?.toLowerCase?.();
    if (email && !STAFF_EMAILS.has(email)) emails.add(email);
  }
  for (const entry of waitlist.entries ?? []) {
    const email = entry?.email?.toLowerCase?.();
    if (email && !STAFF_EMAILS.has(email)) emails.add(email);
  }

  return { emails: [...emails].sort(), accounts };
}

async function purgeRecordStoreByUserId(path, label) {
  const store = await readJsonOptional(path, {});
  const before = Object.keys(store).length;
  for (const userId of Object.keys(store)) {
    if (!isStaffUserId(userId)) delete store[userId];
  }
  const after = Object.keys(store).length;
  if (before !== after) {
    await writeJson(path, store);
    console.log(`✓ ${label}: removed ${before - after} (kept ${after})`);
  } else {
    console.log(`· ${label}: nothing to remove`);
  }
  return before - after;
}

async function purgeWarmupProgress() {
  const store = await readJsonOptional("demo/member-warmup-progress.json", {});
  let removed = 0;
  for (const key of Object.keys(store)) {
    const userId = store[key]?.userId ?? key.split("::")[0];
    if (!isStaffUserId(userId)) {
      delete store[key];
      removed += 1;
    }
  }
  if (removed > 0) {
    await writeJson("demo/member-warmup-progress.json", store);
    console.log(`✓ member-warmup-progress: removed ${removed}`);
  } else {
    console.log("· member-warmup-progress: nothing to remove");
  }
  return removed;
}

async function purgeQuickAuth() {
  const store = await readJsonOptional("demo/quick-auth-devices.json", {});
  let removed = 0;
  for (const [key, entry] of Object.entries(store)) {
    const email = entry?.email?.toLowerCase?.() ?? key.replace(/^_preset:/, "");
    if (!STAFF_EMAILS.has(email)) {
      delete store[key];
      removed += 1;
    }
  }
  if (removed > 0) {
    await writeJson("demo/quick-auth-devices.json", store);
    console.log(`✓ quick-auth-devices: removed ${removed}`);
  } else {
    console.log("· quick-auth-devices: nothing to remove");
  }
  return removed;
}

async function purgeWorkoutLogs() {
  const store = await readJsonOptional("demo/member-workout-logs.json", { workoutLogs: [] });
  const logs = Array.isArray(store.workoutLogs) ? store.workoutLogs : [];
  const before = logs.length;
  store.workoutLogs = logs.filter((log) => isStaffUserId(log.userId));
  const removed = before - store.workoutLogs.length;
  if (removed > 0) {
    await writeJson("demo/member-workout-logs.json", store);
    console.log(`✓ member-workout-logs: removed ${removed}`);
  } else {
    console.log("· member-workout-logs: nothing to remove");
  }
  return removed;
}

async function purgeEnrollments() {
  return purgeRecordStoreByUserId("demo/member-enrollments.json", "member-enrollments");
}

async function clearWaitlist() {
  const waitlist = { entries: [] };
  await writeJson("demo/waitlist.json", waitlist);
  console.log("✓ waitlist: cleared");
}

async function resetChat() {
  const empty = { threads: [], messages: [] };
  await writeJson("demo/coach-chat.json", empty);
  console.log("✓ coach-chat: cleared");
}

async function clearPasswordResetTokens() {
  await writeJson("demo/password-reset-tokens.json", { tokens: [] });
  console.log("✓ password-reset-tokens: cleared");
}

async function normalizeStaffAccounts(existingAccounts) {
  const next = {};
  for (const email of STAFF_EMAILS) {
    const account = existingAccounts[email];
    if (!account) {
      console.warn(`⚠ missing staff account in blob: ${email}`);
      continue;
    }
    next[email] = {
      ...account,
      role: "ADMIN",
    };
  }
  await writeJson("demo/registered-accounts.json", next);
  console.log(`✓ registered-accounts: kept ${Object.keys(next).length} staff admin(s)`);
  return next;
}

async function purgeProfiles() {
  const profiles = await readJson("demo/member-profiles.json");
  const before = Object.keys(profiles).length;
  for (const [userId, profile] of Object.entries(profiles)) {
    const email = profile?.email?.toLowerCase?.();
    if (!isStaffUserId(userId) && !STAFF_EMAILS.has(email)) {
      delete profiles[userId];
    }
  }
  const after = Object.keys(profiles).length;
  if (before !== after) {
    await writeJson("demo/member-profiles.json", profiles);
    console.log(`✓ member-profiles: removed ${before - after}`);
  } else {
    console.log("· member-profiles: nothing to remove");
  }
  return before - after;
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — production launch purge\n" : "Production launch purge\n");

  const { emails } = await collectEmailsToPurge();
  console.log(`Found ${emails.length} non-staff email(s) to reset\n`);

  const resetResults = [];
  for (const email of emails) {
    if (DRY_RUN) {
      console.log(`[dry-run] would fully reset ${email}`);
      continue;
    }
    console.log(`Resetting ${email}...`);
    const result = await fullyResetMemberByEmail(email);
    resetResults.push(result);
    console.log(
      `  account=${result.accountRemoved} profiles=${result.profilesRemoved} waitlist=${result.waitlistRemoved}`,
    );
  }

  console.log("\nBulk store cleanup...");
  if (!DRY_RUN) {
    const accounts = await readJson("demo/registered-accounts.json");
    await normalizeStaffAccounts(accounts);
    await purgeProfiles();
    await clearWaitlist();
    await purgeEnrollments();
    await purgeWorkoutLogs();
    await purgeRecordStoreByUserId("demo/member-gamification.json", "member-gamification");
    await purgeRecordStoreByUserId("demo/user-settings.json", "user-settings");
    await purgeRecordStoreByUserId("demo/user-equipment.json", "user-equipment");
    await purgeRecordStoreByUserId("demo/member-coach-prefs.json", "member-coach-prefs");
    await purgeWarmupProgress();
    await purgeQuickAuth();
    await clearPasswordResetTokens();
    await resetChat();
  }

  if (!DRY_RUN) {
    const finalAccounts = await readJson("demo/registered-accounts.json");
    const finalProfiles = await readJsonOptional("demo/member-profiles.json", {});
    const finalWaitlist = await readJsonOptional("demo/waitlist.json", { entries: [] });
    console.log("\nFinal state:");
    console.log(
      JSON.stringify(
        {
          accounts: Object.entries(finalAccounts).map(([email, acc]) => ({
            email,
            role: acc.role,
            userId: acc.userId,
          })),
          profileCount: Object.keys(finalProfiles).length,
          waitlistCount: finalWaitlist.entries?.length ?? 0,
          resetsAttempted: resetResults.length,
        },
        null,
        2,
      ),
    );
  }

  console.log(DRY_RUN ? "\nDry run complete." : "\nLaunch purge complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});