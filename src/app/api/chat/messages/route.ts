import { NextResponse } from "next/server";
import {
  getMessagesForThread,
  markThreadRead,
  COACH_READER_ID,
  hydrateCoachChat,
  resolveThreadById,
} from "@/lib/coach-chat";
import { resolveMemberUserId } from "@/lib/current-user";

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

  const role = searchParams.get("role") || "member";
  const readerId = role === "coach" ? COACH_READER_ID : await resolveMemberUserId();
  await markThreadRead(threadId, readerId);

  const messages = getMessagesForThread(threadId);

  return NextResponse.json(
    { thread, messages },
    { headers: { "Cache-Control": "no-store" } },
  );
}