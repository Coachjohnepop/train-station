import { NextResponse } from "next/server";
import { z } from "zod";
import {
  COACH_READER_ID,
  flagThreadUnreadForCoach,
  hydrateCoachChat,
  markAllCoachThreadsRead,
  markThreadRead,
  resolveThreadById,
  getUnreadCountForCoach,
  getUnreadCountsByThreadForCoach,
} from "@/lib/coach-chat";
import { requireCoachStaff } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** Clear badge on one thread (mark member messages read). */
  threadId: z.string().min(1).optional(),
  /** Clear every coach inbox badge. */
  all: z.boolean().optional(),
  /**
   * Put the badge back on a thread (un-read member messages) so it shows again later.
   * Requires threadId.
   */
  reflag: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await hydrateCoachChat({ preferFresh: true });

  if (parsed.data.reflag) {
    if (!parsed.data.threadId) {
      return NextResponse.json({ error: "threadId required to reflag." }, { status: 400 });
    }
    const thread = await resolveThreadById(parsed.data.threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }
    const flagged = await flagThreadUnreadForCoach(parsed.data.threadId);
    return NextResponse.json({
      ok: true,
      reflagged: flagged,
      unread: getUnreadCountForCoach(),
      unreadByThread: getUnreadCountsByThreadForCoach(),
    });
  }

  if (parsed.data.all) {
    const result = await markAllCoachThreadsRead();
    return NextResponse.json({
      ok: true,
      ...result,
      unread: getUnreadCountForCoach(),
      unreadByThread: getUnreadCountsByThreadForCoach(),
    });
  }

  if (!parsed.data.threadId) {
    return NextResponse.json({ error: "threadId or all required." }, { status: 400 });
  }

  const thread = await resolveThreadById(parsed.data.threadId);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }

  await markThreadRead(parsed.data.threadId, COACH_READER_ID);
  await hydrateCoachChat({ preferFresh: true });

  return NextResponse.json({
    ok: true,
    threadId: parsed.data.threadId,
    unread: getUnreadCountForCoach(),
    unreadByThread: getUnreadCountsByThreadForCoach(),
  });
}
