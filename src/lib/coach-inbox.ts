import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";

export type CoachInboxKind = "signup" | "booking" | "zoom";

export type CoachInboxItemDto = {
  id: string;
  kind: CoachInboxKind;
  title: string;
  body: string;
  href: string | null;
  memberUserId: string | null;
  memberEmail: string | null;
  memberName: string | null;
  readAt: string | null;
  createdAt: string;
};

function asKind(raw: string): CoachInboxKind {
  if (raw === "booking" || raw === "zoom") return raw;
  return "signup";
}

export async function postCoachInboxItem(input: {
  kind: CoachInboxKind;
  title: string;
  body: string;
  href?: string | null;
  memberUserId?: string | null;
  memberEmail?: string | null;
  memberName?: string | null;
  claimKey: string;
  metadata?: Record<string, unknown>;
}): Promise<{ created: boolean; id?: string }> {
  if (!isDatabaseConfigured()) return { created: false };
  const claimKey = input.claimKey.trim().slice(0, 180);
  if (!claimKey) return { created: false };
  try {
    const { prisma } = await import("@/lib/prisma");
    const existing = await prisma.coachInboxItem.findUnique({
      where: { claimKey },
      select: { id: true },
    });
    if (existing) return { created: false, id: existing.id };
    const row = await prisma.coachInboxItem.create({
      data: {
        kind: input.kind,
        title: input.title.slice(0, 160),
        body: input.body.slice(0, 4000),
        href: input.href?.slice(0, 400) || null,
        memberUserId: input.memberUserId || null,
        memberEmail: input.memberEmail?.trim().toLowerCase() || null,
        memberName: input.memberName?.trim() || null,
        claimKey,
        metadata: input.metadata
          ? (JSON.parse(JSON.stringify(input.metadata)) as object)
          : undefined,
      },
      select: { id: true },
    });
    return { created: true, id: row.id };
  } catch (e) {
    console.warn("[coach-inbox] write failed", e);
    return { created: false };
  }
}

export async function listCoachInbox(params?: {
  unreadOnly?: boolean;
  kind?: CoachInboxKind;
  limit?: number;
}): Promise<CoachInboxItemDto[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.coachInboxItem.findMany({
      where: {
        ...(params?.unreadOnly ? { readAt: null } : {}),
        ...(params?.kind ? { kind: params.kind } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(200, Math.max(1, params?.limit ?? 80)),
    });
    return rows.map((row) => ({
      id: row.id,
      kind: asKind(row.kind),
      title: row.title,
      body: row.body,
      href: row.href,
      memberUserId: row.memberUserId,
      memberEmail: row.memberEmail,
      memberName: row.memberName,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    }));
  } catch (e) {
    console.warn("[coach-inbox] list failed", e);
    return [];
  }
}

export async function countUnreadCoachInbox(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  try {
    const { prisma } = await import("@/lib/prisma");
    return await prisma.coachInboxItem.count({ where: { readAt: null } });
  } catch {
    return 0;
  }
}

export async function markCoachInboxRead(id: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.coachInboxItem.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return true;
  } catch {
    return false;
  }
}

export async function markAllCoachInboxRead(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  try {
    const { prisma } = await import("@/lib/prisma");
    const result = await prisma.coachInboxItem.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  } catch {
    return 0;
  }
}

export function inboxKindFromCoachEvent(
  event: string,
): CoachInboxKind | null {
  if (event === "newMember") return "signup";
  if (event === "intakeScheduled") return "booking";
  if (event === "zoomWaiting") return "zoom";
  return null;
}
