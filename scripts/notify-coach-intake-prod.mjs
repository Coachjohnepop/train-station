#!/usr/bin/env node
/**
 * Send coach intake sign-off alert (email + in-app) for a member.
 *
 *   node scripts/notify-coach-intake-prod.mjs john@bcxvoice.com
 */
import { randomUUID } from "crypto";
import { blobOptions } from "./remove-member-email.mjs";

const ACCOUNTS_PATH = "demo/registered-accounts.json";
const PROFILES_PATH = "demo/member-profiles.json";
const CHAT_PATH = "demo/coach-chat.json";

const COACH_EMAIL = process.env.COACH_NOTIFY_EMAIL?.split(",")[0]?.trim() || "jeremy@thetrainstation.co";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.thetrainstation.co";

async function readJson(path) {
  const { head } = await import("@vercel/blob");
  const meta = await head(path, blobOptions());
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

function isPaidPlan(plan) {
  return plan === "member" || plan === "pro" || plan === "business";
}

function planLabel(plan) {
  if (plan === "member") return "1st Class";
  if (plan === "pro") return "Pro";
  if (plan === "business") return "Business";
  if (plan === "explorer") return "Explorer";
  return plan;
}

async function sendEmail({ subject, text, ctaUrl }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.log("[email skipped] RESEND_API_KEY not set");
    console.log(`To: ${COACH_EMAIL}\nSubject: ${subject}\n${text}`);
    return false;
  }

  const from =
    process.env.RESEND_FROM?.trim() ||
    process.env.LEAD_NOTIFY_FROM?.trim() ||
    "The Train Station <john@thetrainstation.co>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [COACH_EMAIL],
      subject: `${subject} — Train Station`,
      text: `${text}\n\nOpen: ${ctaUrl}`,
      reply_to: process.env.RESEND_REPLY_TO || COACH_EMAIL,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend failed:", res.status, err);
    return false;
  }
  console.log(`✓ Email sent to ${COACH_EMAIL}`);
  return true;
}

async function postInAppSystemMessage(memberId, body) {
  const store = await readJson(CHAT_PATH);
  const threadId = `thread-member-${memberId}`;
  let thread = store.threads?.find((t) => t.id === threadId);
  const now = new Date().toISOString();

  if (!thread) {
    thread = {
      id: threadId,
      kind: "member",
      memberId,
      title: "Member",
      createdAt: now,
      updatedAt: now,
    };
    store.threads = store.threads || [];
    store.threads.push(thread);
  } else {
    thread.updatedAt = now;
  }

  const message = {
    id: randomUUID(),
    threadId,
    authorRole: "system",
    authorId: "system",
    authorName: "Train Station",
    kind: "system",
    body,
    sessionDate: now.slice(0, 10),
    createdAt: now,
    readByUserIds: [],
  };

  store.messages = store.messages || [];
  store.messages.push(message);
  await writeJson(CHAT_PATH, store);
  console.log("✓ In-app alert posted to coach chat");
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: node scripts/notify-coach-intake-prod.mjs <member-email>");
    process.exit(1);
  }

  const accounts = await readJson(ACCOUNTS_PATH);
  const account = accounts[email];
  if (!account) {
    console.error(`No account for ${email}`);
    process.exit(1);
  }

  const profiles = await readJson(PROFILES_PATH);
  const profile = profiles[account.userId];
  if (!profile) {
    console.error(`No profile for ${email}`);
    process.exit(1);
  }

  if (profile.coachIntakeCompleteAt) {
    console.log("Intake already signed off — nothing to send.");
    process.exit(0);
  }

  const name = account.name || email;
  const paymentPending =
    isPaidPlan(profile.plan) &&
    profile.paymentStatus !== "paid" &&
    profile.paymentStatus !== "none";

  const paymentNote = paymentPending
    ? "\n\nPayment is still pending — use Queue to mark paid (Venmo/cash) when you accept them."
    : "";

  const subject = "Intake sign-off needed";
  const message = `${name} is ready for coach intake sign-off.${paymentNote}\n\nPlan: ${planLabel(profile.plan)}\nMember: ${name} <${email}>`;
  const queueUrl = `${APP_URL}/admin/queue`;

  await sendEmail({ subject, text: message, ctaUrl: queueUrl });
  await postInAppSystemMessage(
    account.userId,
    `${subject}\n\n${message}\n\nOpen Queue: ${queueUrl}`,
  );

  console.log(`\nCoach alerted for ${name} (${email})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});