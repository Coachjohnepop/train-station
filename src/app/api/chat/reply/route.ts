import { NextResponse } from "next/server";
import {
  addChatMessage,
  COACH_READER_ID,
  ensureMemberThread,
  hydrateCoachChat,
  resolveThreadById,
} from "@/lib/coach-chat";
import { resolveUserId } from "@/lib/current-user";
import { DEMO_COACH } from "@/lib/demo-coach";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { sendCoachReplySms } from "@/lib/sms";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const role = body.role === "coach" ? "coach" : "member";
  const threadId = typeof body.threadId === "string" ? body.threadId : "";
  const sendSms = body.sendSms !== false;

  if (message.length < 1) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  await hydrateCoachChat();

  if (role === "coach") {
    if (!threadId) {
      return NextResponse.json({ error: "threadId is required for coach replies" }, { status: 400 });
    }
    const thread = await resolveThreadById(threadId);
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

    let smsResult = { sent: 0 };
    if (sendSms && thread.kind === "member" && thread.memberId) {
      smsResult = await sendCoachReplySms({ memberId: thread.memberId, message });
    }

    return NextResponse.json({ ok: true, message: created, sms: smsResult });
  }

  const uid = await resolveUserId();
  const user = resolveDemoUser(uid);
  const thread = threadId ? await resolveThreadById(threadId) : null;
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