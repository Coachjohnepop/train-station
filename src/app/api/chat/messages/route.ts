import { NextResponse } from "next/server";
import {
  getMessagesForThread,
  markThreadRead,
  COACH_READER_ID,
  hydrateCoachChat,
  resolveThreadById,
} from "@/lib/coach-chat";
import { assertChatThreadAccess } from "@/lib/chat-thread-access";
import { isStaffRole } from "@/lib/auth-session";
import { notifyCoachMessagesOpened } from "@/lib/coach-member-notify";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("threadId");
  if (!threadId) {
    return NextResponse.json({ error: "threadId required" }, { status: 400 });
  }

  await hydrateCoachChat({ preferFresh: true });
  const thread = await resolveThreadById(threadId);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const role = searchParams.get("role") === "coach" ? "coach" : "member";
  const access = await assertChatThreadAccess(thread, { role });
  if (!access.ok) return access.response;

  const readerId =
    role === "coach" && isStaffRole(access.session.role)
      ? COACH_READER_ID
      : access.memberId;
  // Coaches keep badges until they explicitly Clear badge (markRead=1) or reply.
  // Members still auto-clear when they open a thread.
  const markReadParam = searchParams.get("markRead");
  const shouldMarkRead =
    role === "member"
      ? markReadParam !== "0"
      : markReadParam === "1";
  if (shouldMarkRead) {
    await markThreadRead(threadId, readerId);
  }

  // First time a real member opens Messages → always notify Jeremy (one-shot).
  if (
    role === "member" &&
    access.session.role === "MEMBER" &&
    access.memberId
  ) {
    void notifyCoachMessagesOpened({
      userId: access.memberId,
      name: access.session.name || "Member",
      email: access.session.email,
    }).catch((e) => console.warn("[chat] messages-opened notify failed", e));
  }

  const messages = getMessagesForThread(threadId);

  return NextResponse.json(
    { thread, messages },
    { headers: { "Cache-Control": "no-store" } },
  );
}