#!/usr/bin/env node
/**
 * Fully reset a self-registered member on production — account, profile,
 * gamification, chat thread, warmup progress, quick-auth, settings.
 *
 * Usage:
 *   node scripts/reset-member-full-prod.mjs john@bcxvoice.com
 */
import { removeMemberByEmail, blobOptions } from "./remove-member-email.mjs";
import { head, put } from "@vercel/blob";

async function readJson(path) {
  const opts = blobOptions();
  const meta = await head(path, opts);
  const res = await fetch(`${meta.url}?_ts=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`read ${path}: ${res.status}`);
  return res.json();
}

async function writeJson(path, data) {
  await put(path, JSON.stringify(data, null, 2), {
    ...blobOptions(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function purgeUserIdFromRecordStore(path, userId) {
  const store = await readJson(path);
  if (!(userId in store)) return 0;
  delete store[userId];
  await writeJson(path, store);
  return 1;
}

async function purgeWarmupProgress(userId) {
  const store = await readJson("demo/member-warmup-progress.json");
  let removed = 0;
  for (const key of Object.keys(store)) {
    if (key.startsWith(`${userId}::`) || store[key]?.userId === userId) {
      delete store[key];
      removed += 1;
    }
  }
  if (removed > 0) await writeJson("demo/member-warmup-progress.json", store);
  return removed;
}

async function purgeQuickAuth(email) {
  const normalized = email.trim().toLowerCase();
  const store = await readJson("demo/quick-auth-devices.json");
  let removed = 0;
  for (const [key, entry] of Object.entries(store)) {
    const entryEmail = entry?.email?.toLowerCase?.();
    if (key === `_preset:${normalized}` || entryEmail === normalized) {
      delete store[key];
      removed += 1;
    }
  }
  if (removed > 0) await writeJson("demo/quick-auth-devices.json", store);
  return removed;
}

async function purgeChatThread(userId) {
  const threadId = `thread-member-${userId}`;
  const store = await readJson("demo/coach-chat.json");
  const beforeThreads = store.threads?.length ?? 0;
  const beforeMessages = store.messages?.length ?? 0;
  store.threads = (store.threads ?? []).filter((t) => t.id !== threadId);
  store.messages = (store.messages ?? []).filter((m) => m.threadId !== threadId);
  const threadsRemoved = beforeThreads - store.threads.length;
  const messagesRemoved = beforeMessages - store.messages.length;
  if (threadsRemoved > 0 || messagesRemoved > 0) {
    await writeJson("demo/coach-chat.json", store);
  }
  return { threadsRemoved, messagesRemoved };
}

async function purgePasswordResetTokens(email) {
  const normalized = email.trim().toLowerCase();
  const store = await readJson("demo/password-reset-tokens.json");
  if (!Array.isArray(store.tokens)) return 0;
  const before = store.tokens.length;
  store.tokens = store.tokens.filter((t) => t.email?.toLowerCase() !== normalized);
  const removed = before - store.tokens.length;
  if (removed > 0) await writeJson("demo/password-reset-tokens.json", store);
  return removed;
}

export async function fullyResetMemberByEmail(email) {
  const accounts = await readJson("demo/registered-accounts.json");
  const userId = accounts[email.trim().toLowerCase()]?.userId ?? null;

  const summary = await removeMemberByEmail(email);
  summary.userId = summary.userId || userId;

  if (!summary.userId) {
    return { ...summary, fullyReset: false, reason: "no_user_found" };
  }

  const uid = summary.userId;
  summary.gamificationRemoved = await purgeUserIdFromRecordStore("demo/member-gamification.json", uid);
  summary.userSettingsRemoved = await purgeUserIdFromRecordStore("demo/user-settings.json", uid);
  summary.userEquipmentRemoved = await purgeUserIdFromRecordStore("demo/user-equipment.json", uid);
  summary.warmupProgressRemoved = await purgeWarmupProgress(uid);
  summary.quickAuthRemoved = await purgeQuickAuth(email);
  summary.passwordResetTokensRemoved = await purgePasswordResetTokens(email);
  summary.chat = await purgeChatThread(uid);
  summary.fullyReset = true;

  return summary;
}

const emailArg = process.argv[2]?.trim().toLowerCase();
if (!emailArg) {
  console.error("Usage: node scripts/reset-member-full-prod.mjs <email>");
  process.exit(1);
}

try {
  console.log(`Fully resetting ${emailArg} on production...\n`);
  const result = await fullyResetMemberByEmail(emailArg);
  console.log(JSON.stringify(result, null, 2));
  if (!result.fullyReset && result.reason === "no_user_found") {
    console.log("\nNo account found — nothing to reset.");
    process.exit(0);
  }
  console.log("\nDone. They can sign up fresh at /signup with that email.");
} catch (e) {
  console.error(e);
  process.exit(1);
}