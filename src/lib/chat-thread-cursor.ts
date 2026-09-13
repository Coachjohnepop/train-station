import "server-only";

import { isDemoMode } from "@/lib/demo-enrollments";
import { prisma } from "@/lib/prisma";
import type { MemberChatWindow } from "@/lib/chat-message-window";

export type { MemberChatWindow };
export { messageInArchiveView, messageInLiveView } from "@/lib/chat-message-window";

function iso(d: Date | null | undefined): string | null {
  if (!d) return null;
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  return d.toISOString();
}

type DemoCursor = { userId: string; threadId: string; clearedAt: string };
let demoCursors: DemoCursor[] = [];

export async function loadMemberChatWindows(
  userId: string,
  threads: Array<{ id: string; kind: string; programSlug?: string | null; memberId?: string | null }>,
): Promise<Record<string, MemberChatWindow>> {
  const windows: Record<string, MemberChatWindow> = {};
  if (!userId) return windows;

  let userCreated: string | null = null;
  const enrollBySlug = new Map<string, string>();
  const cleared = new Map<string, string>();

  if (!isDemoMode()) {
    try {
      const [user, enrolls] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
        prisma.programEnrollment.findMany({
          where: { userId },
          select: { startedAt: true, program: { select: { slug: true } } },
        }),
      ]);
      userCreated = iso(user?.createdAt);
      for (const row of enrolls) {
        const slug = row.program.slug;
        const started = iso(row.startedAt);
        if (slug && started) enrollBySlug.set(slug, started);
      }
      try {
        const cursors = await prisma.chatThreadCursor.findMany({
          where: { userId },
          select: { threadId: true, clearedAt: true },
        });
        for (const c of cursors) {
          cleared.set(c.threadId, c.clearedAt.toISOString());
        }
      } catch (e) {
        console.warn("[chat-cursor] cursor table not ready", e);
      }
    } catch (e) {
      console.warn("[chat-cursor] load windows failed", e);
    }
  } else {
    for (const c of demoCursors) {
      if (c.userId === userId) cleared.set(c.threadId, c.clearedAt);
    }
  }

  for (const t of threads) {
    let joinAfterIso: string | null = null;
    if (t.kind === "cohort") {
      joinAfterIso = (t.programSlug && enrollBySlug.get(t.programSlug)) || userCreated;
    } else if (t.kind === "member") {
      joinAfterIso = userCreated;
    }
    windows[t.id] = {
      joinAfterIso,
      clearedAtIso: cleared.get(t.id) || null,
    };
  }
  return windows;
}

export async function clearThreadForMember(userId: string, threadId: string): Promise<string> {
  const clearedAt = new Date();
  if (isDemoMode()) {
    demoCursors = demoCursors.filter((c) => !(c.userId === userId && c.threadId === threadId));
    demoCursors.push({ userId, threadId, clearedAt: clearedAt.toISOString() });
    return clearedAt.toISOString();
  }
  await prisma.chatThreadCursor.upsert({
    where: { userId_threadId: { userId, threadId } },
    create: { userId, threadId, clearedAt },
    update: { clearedAt },
  });
  return clearedAt.toISOString();
}
