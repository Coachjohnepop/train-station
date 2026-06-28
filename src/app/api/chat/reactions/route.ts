import { NextResponse } from "next/server";
import {
  COACH_READER_ID,
  getThread,
  hydrateCoachChat,
  toggleMessageReaction,
} from "@/lib/coach-chat";
import { isStaffRole } from "@/lib/auth-session";
import { assertChatThreadAccess } from "@/lib/chat-thread-access";

const QUICK_EMOJI = new Set(["✅", "👍", "❤️", "🙌", "💪", "🔥", "👀", "😂"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const messageId = typeof body.messageId === "string" ? body.messageId : "";
  const emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";
  const role = body.role === "coach" ? "coach" : "member";

  if (!messageId || !emoji) {
    return NextResponse.json({ error: "messageId and emoji required" }, { status: 400 });
  }
  if (!QUICK_EMOJI.has(emoji)) {
    return NextResponse.json({ error: "Unsupported emoji" }, { status: 400 });
  }

  const store = await hydrateCoachChat();
  const messageMatch = store.messages.find((m) => m.id === messageId);
  if (!messageMatch) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const thread = getThread(messageMatch.threadId);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const access = await assertChatThreadAccess(thread, { role });
  if (!access.ok) return access.response;

  const userId =
    role === "coach" && isStaffRole(access.session.role) ? COACH_READER_ID : access.memberId;
  const message = await toggleMessageReaction(messageId, userId, emoji);
  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, message });
}