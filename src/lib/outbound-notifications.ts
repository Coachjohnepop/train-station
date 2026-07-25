import "server-only";

import { isDemoMode } from "@/lib/demo-enrollments";

export type OutboundChannel = "email" | "push" | "in_app";

export type OutboundNotificationStatus =
  | "sent"
  | "failed"
  | "skipped_paused"
  | "skipped_no_key"
  | "skipped_misconfigured"
  | "skipped_no_recipient";

export type RecordOutboundNotificationInput = {
  channel: OutboundChannel;
  category?: string;
  status: OutboundNotificationStatus;
  toAddress?: string | null;
  userId?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  provider?: string | null;
  providerId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
};

function previewText(text: string | null | undefined, max = 400): string | null {
  if (!text?.trim()) return null;
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Persist an outbound notification attempt to Postgres.
 * Never throws to callers — logging must not break sends.
 */
export async function recordOutboundNotification(
  input: RecordOutboundNotificationInput,
): Promise<string | null> {
  if (isDemoMode()) return null;

  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.outboundNotification.create({
      data: {
        channel: input.channel,
        category: (input.category || "unknown").slice(0, 80),
        status: input.status,
        toAddress: input.toAddress?.trim().slice(0, 500) || null,
        userId: input.userId?.trim() || null,
        subject: input.subject?.trim().slice(0, 500) || null,
        bodyPreview: previewText(input.bodyPreview),
        provider: input.provider?.slice(0, 40) || null,
        providerId: input.providerId?.slice(0, 200) || null,
        errorMessage: input.errorMessage?.slice(0, 2000) || null,
        metadata: input.metadata
          ? (JSON.parse(JSON.stringify(input.metadata)) as object)
          : undefined,
      },
      select: { id: true },
    });
    return row.id;
  } catch (e) {
    console.warn("[outbound-notification] persist failed", e);
    return null;
  }
}

/** Map Resend tags / subject heuristics into a stable category. */
export function categoryFromEmailTags(
  tags?: Array<{ name: string; value: string }> | null,
  subject?: string,
): string {
  const cat = tags?.find((t) => t.name === "category")?.value?.trim();
  if (cat) return cat.slice(0, 80);
  const s = (subject || "").toLowerCase();
  if (s.includes("password")) return "password-reset";
  if (s.includes("welcome")) return "welcome";
  if (s.includes("workout") || s.includes("finished") || s.includes("logged")) {
    return "workout-complete";
  }
  if (s.includes("staff grant") || s.includes("reapproval")) return "staff-grant";
  return "email";
}
