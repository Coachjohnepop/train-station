#!/usr/bin/env node
/**
 * Move a chat message to the correct thread in prod blob storage.
 *
 * Usage:
 *   node scripts/remap-chat-message.mjs <messageId> <targetThreadId>
 */
import dotenv from "dotenv";
import { head, put } from "@vercel/blob";

dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const messageId = process.argv[2];
const targetThreadId = process.argv[3];

if (!messageId || !targetThreadId) {
  console.error("Usage: node scripts/remap-chat-message.mjs <messageId> <targetThreadId>");
  process.exit(1);
}

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error("BLOB_READ_WRITE_TOKEN required");
  process.exit(1);
}

const BLOB_PATH = "demo/coach-chat.json";

async function main() {
  const meta = await head(BLOB_PATH, { token });
  const res = await fetch(meta.url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const store = await res.json();

  const message = store.messages?.find((m) => m.id === messageId);
  if (!message) {
    console.error(`Message not found: ${messageId}`);
    process.exit(1);
  }

  const target = store.threads?.find((t) => t.id === targetThreadId);
  if (!target) {
    console.error(`Target thread not found: ${targetThreadId}`);
    process.exit(1);
  }

  const fromThreadId = message.threadId;
  console.log(`Moving "${message.body}"`);
  console.log(`  ${fromThreadId} → ${targetThreadId} (${target.kind})`);

  message.threadId = targetThreadId;
  target.updatedAt = new Date().toISOString();

  await put(BLOB_PATH, JSON.stringify(store, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });

  console.log("✅ Saved to blob");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});