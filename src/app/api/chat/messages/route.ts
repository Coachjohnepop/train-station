import { NextResponse } from "next/server";
import {
  getMessagesForThread,
  getThread,
  markThreadRead,
  COACH_READER_ID,
  hydrateCoachChat,
} from "@/lib/coach-chat";
import { resolveUserId } from "@/lib/current-user";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("threadId");
  if (!threadId) {
    return NextResponse.json({ error: "threadId required" }, { status: 400 });
  }

  await hydrateCoachChat();
  const thread = getThread(threadId);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const role = searchParams.get("role") || "member";
  const readerId = role === "coach" ? COACH_READER_ID : await resolveUserId();
  await markThreadRead(threadId, readerId);

  const messages = getMessagesForThread(threadId);

  return NextResponse.json({
    thread,
    messages,
  });
}