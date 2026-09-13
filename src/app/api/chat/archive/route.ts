import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  getMessagesForThread,
  hydrateCoachChat,
  listThreadsForMember,
} from "@/lib/coach-chat";
import { resolveMemberVisibleCohortSlugs } from "@/lib/member-chat-access";
import { loadMemberChatWindows } from "@/lib/chat-thread-cursor";
import { messageInArchiveView } from "@/lib/chat-message-window";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (session.role !== "MEMBER" && !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Member required." }, { status: 403 });
  }

  const uid = session.id;
  await hydrateCoachChat({ preferFresh: true });
  const slugs = await resolveMemberVisibleCohortSlugs(uid);
  const threads = listThreadsForMember(uid, slugs);
  const windows = await loadMemberChatWindows(uid, threads);

  const slices = threads
    .map((thread) => {
      const w = windows[thread.id];
      const messages = getMessagesForThread(thread.id, 500).filter((m) =>
        messageInArchiveView(m.createdAt, w),
      );
      return { thread, messages };
    })
    .filter((s) => s.messages.length > 0);

  return NextResponse.json(
    { slices },
    { headers: { "Cache-Control": "no-store" } },
  );
}
