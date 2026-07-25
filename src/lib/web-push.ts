/**
 * Web Push for home-screen PWA badge + phone alerts when app is backgrounded.
 * Requires VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (and optional VAPID_SUBJECT).
 */

import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-enrollments";
import { alwaysOnCommunitySlugs } from "@/lib/community-feed";
import type { ChatMessage, ChatThread } from "@/lib/coach-chat-types";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  unread?: number;
  tag?: string;
};

function vapidConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
}

export function getVapidPublicKey(): string | null {
  const k = process.env.VAPID_PUBLIC_KEY?.trim();
  return k || null;
}

function configureWebPush() {
  if (!vapidConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:john@thetrainstation.co",
    process.env.VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim(),
  );
  return true;
}

export async function savePushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  if (isDemoMode()) return { id: "demo" };
  return prisma.webPushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent || null,
    },
    update: {
      userId: input.userId,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent || null,
    },
  });
}

export async function removePushSubscription(endpoint: string, userId?: string) {
  if (isDemoMode()) return;
  if (userId) {
    await prisma.webPushSubscription.deleteMany({
      where: { endpoint, userId },
    });
    return;
  }
  await prisma.webPushSubscription.deleteMany({ where: { endpoint } });
}

export async function sendPushToUserIds(
  userIds: string[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!userIds.length || isDemoMode()) {
    return { sent: 0, failed: 0 };
  }
  if (!configureWebPush()) {
    try {
      const { recordOutboundNotification } = await import("@/lib/outbound-notifications");
      await recordOutboundNotification({
        channel: "push",
        category: payload.tag?.startsWith("chat-") ? "chat-push" : "push",
        status: "skipped_no_key",
        subject: payload.title,
        bodyPreview: payload.body,
        provider: "web-push",
        metadata: { userIds, reason: "vapid_not_configured" },
      });
    } catch {
      /* ignore */
    }
    return { sent: 0, failed: 0 };
  }

  const unique = [...new Set(userIds.filter(Boolean))];
  const subs = await prisma.webPushSubscription.findMany({
    where: { userId: { in: unique } },
  });
  if (!subs.length) {
    try {
      const { recordOutboundNotification } = await import("@/lib/outbound-notifications");
      await recordOutboundNotification({
        channel: "push",
        category: payload.tag?.startsWith("chat-") ? "chat-push" : "push",
        status: "skipped_no_recipient",
        subject: payload.title,
        bodyPreview: payload.body,
        provider: "web-push",
        metadata: { userIds: unique, reason: "no_subscriptions" },
      });
    } catch {
      /* ignore */
    }
    return { sent: 0, failed: 0 };
  }

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 * 12, urgency: "high" },
        );
        sent += 1;
      } catch (e: unknown) {
        failed += 1;
        const status = (e as { statusCode?: number })?.statusCode;
        // Gone / expired subscription
        if (status === 404 || status === 410) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    }),
  );

  if (staleEndpoints.length) {
    await prisma.webPushSubscription.deleteMany({
      where: { endpoint: { in: staleEndpoints } },
    });
  }

  // One durable row per fan-out (detail in metadata) — avoids N rows for multi-device users.
  try {
    const { recordOutboundNotification } = await import("@/lib/outbound-notifications");
    await recordOutboundNotification({
      channel: "push",
      category: payload.tag?.startsWith("chat-") ? "chat-push" : "push",
      status: sent > 0 ? "sent" : "failed",
      toAddress: unique.slice(0, 5).join(","),
      subject: payload.title,
      bodyPreview: payload.body,
      provider: "web-push",
      errorMessage: failed > 0 && sent === 0 ? `${failed} device(s) failed` : null,
      metadata: {
        userIds: unique,
        devices: subs.length,
        sent,
        failed,
        staleRemoved: staleEndpoints.length,
        url: payload.url ?? null,
        tag: payload.tag ?? null,
      },
    });
  } catch {
    /* ignore */
  }

  return { sent, failed };
}

async function staffUserIds(): Promise<string[]> {
  if (isDemoMode()) return [];
  const rows = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "INSTRUCTOR", "PLATFORM_ADMIN"] } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function memberIdsForCohort(programSlug: string | null | undefined): Promise<string[]> {
  if (isDemoMode()) return [];
  const slug = programSlug || "";
  if (!slug) return [];

  if (alwaysOnCommunitySlugs().includes(slug)) {
    const members = await prisma.user.findMany({
      where: { role: "MEMBER", status: "active", hidden: false },
      select: { id: true },
    });
    return members.map((m) => m.id);
  }

  const enrolled = await prisma.programEnrollment.findMany({
    where: { program: { slug } },
    select: { userId: true },
  });
  return [...new Set(enrolled.map((e) => e.userId))];
}

function previewBody(message: ChatMessage): string {
  if (message.body?.trim()) {
    const t = message.body.trim();
    return t.length > 120 ? `${t.slice(0, 117)}…` : t;
  }
  switch (message.kind) {
    case "image":
      return "Sent a photo";
    case "video_upload":
    case "youtube":
      return "Sent a video";
    case "workout_update":
      return message.workoutTitle || "Workout update";
    default:
      return "New message";
  }
}

/**
 * Fire-and-forget push after a chat message is saved.
 * Coach → members; member → coaches.
 */
export async function notifyPushForChatMessage(
  message: ChatMessage,
  thread: ChatThread | null | undefined,
): Promise<{ sent: number; failed: number; recipients: number }> {
  if (!thread || isDemoMode() || !vapidConfigured()) {
    return { sent: 0, failed: 0, recipients: 0 };
  }

  let recipientIds: string[] = [];

  if (message.authorRole === "coach") {
    if (thread.kind === "member" && thread.memberId) {
      recipientIds = [thread.memberId];
    } else if (thread.kind === "cohort") {
      recipientIds = await memberIdsForCohort(thread.programSlug);
    }
  } else {
    // Member (or other) → staff
    recipientIds = await staffUserIds();
  }

  // Don't notify the author if they somehow have a member id match
  recipientIds = recipientIds.filter((id) => id && id !== message.authorId);

  if (!recipientIds.length) {
    return { sent: 0, failed: 0, recipients: 0 };
  }

  const isCoachSide = message.authorRole !== "coach";
  const url = isCoachSide
    ? `/admin/chat?member=${encodeURIComponent(thread.memberId || "")}`
    : "/member/chat";

  const result = await sendPushToUserIds(recipientIds, {
    title: message.authorName || (message.authorRole === "coach" ? "Coach" : "Message"),
    body: previewBody(message),
    url,
    unread: 1,
    tag: `chat-${thread.id}`,
  });

  return { ...result, recipients: recipientIds.length };
}
