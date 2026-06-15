import { NextResponse } from "next/server";
import { addChatMessage, COACH_READER_ID, ensureMemberThread, getThread } from "@/lib/coach-chat";
import { resolveUserId } from "@/lib/current-user";
import { DEMO_COACH } from "@/lib/demo-coach";
import { resolveDemoUser } from "@/lib/demo-user-directory";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const role = body.role === "coach" ? "coach" : "member";
  const threadId = typeof body.threadId === "string" ? body.threadId : "";

  if (message.length < 1) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (role === "coach") {
    if (!threadId) {
      return NextResponse.json({ error: "threadId is required for coach replies" }, { status: 400 });
    }
    const thread = getThread(threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const created = await addChatMessage({
      threadId: thread.id,
      authorRole: "coach",
      authorId: COACH_READER_ID,
      authorName: DEMO_COACH.displayName,
      kind: "text",
      body: message,
      readByUserIds: [COACH_READER_ID],
    });

    return NextResponse.json({ ok: true, message: created });
  }

  const uid = await resolveUserId();
  const user = resolveDemoUser(uid);
  const thread = threadId ? getThread(threadId) : null;
  const target =
    thread && (thread.kind === "member" ? thread.memberId === uid : true)
      ? thread
      : await ensureMemberThread(uid);

  const created = await addChatMessage({
    threadId: target.id,
    authorRole: "member",
    authorId: uid,
    authorName: user?.name || "Member",
    kind: "text",
    body: message,
  });

  return NextResponse.json({ ok: true, message: created });
}