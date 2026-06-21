import { NextResponse } from "next/server";
import { COACH_READER_ID, hydrateCoachChat, toggleMessageReaction } from "@/lib/coach-chat";
import { resolveUserId } from "@/lib/current-user";

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

  const userId = role === "coach" ? COACH_READER_ID : await resolveUserId();
  await hydrateCoachChat();
  const message = await toggleMessageReaction(messageId, userId, emoji);
  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, message });
}