import { NextResponse } from "next/server";
import {
  addChatMessage,
  COACH_READER_ID,
  hydrateCoachChat,
  memberCanPostToThread,
  resolveThreadById,
} from "@/lib/coach-chat";
import { getSessionUser } from "@/lib/auth";
import { resolveMemberUserId } from "@/lib/current-user";
import { coachDisplayName } from "@/lib/demo-coach";
import { getAccountByUserId } from "@/lib/member-accounts-store";
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

  if (role === "coach") {
    if (!threadId) {
      return NextResponse.json({ error: "threadId is required for coach replies" }, { status: 400 });
    }
    const thread = await resolveThreadById(threadId, { preferFresh: true });
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const coachSession = await getSessionUser();
    let created;
    try {
      created = await addChatMessage({
        threadId: thread.id,
        authorRole: "coach",
        authorId: COACH_READER_ID,
        authorName: coachDisplayName(coachSession),
        kind: "text",
        body: message,
        readByUserIds: [COACH_READER_ID],
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Send failed";
      return NextResponse.json({ error: msg }, { status: 503 });
    }

    let smsResult = { sent: 0 } as Awaited<ReturnType<typeof sendCoachReplySms>>;
    if (sendSms && thread.kind === "member" && thread.memberId) {
      smsResult = await sendCoachReplySms({
        memberId: thread.memberId,
        message,
        coachName: coachDisplayName(coachSession),
      });
    }

    return NextResponse.json({
      ok: true,
      message: created,
      sms: smsResult,
      twilioLive: smsResult.sent > 0 && !smsResult.simulated,
    });
  }

  if (!threadId) {
    return NextResponse.json({ error: "threadId is required" }, { status: 400 });
  }

  await hydrateCoachChat({ preferFresh: true });
  const uid = await resolveMemberUserId();
  const user = resolveDemoUser(uid);
  const registered = user ? null : await getAccountByUserId(uid);
  const authorName =
    user?.name || registered?.account.name || registered?.email || "Member";

  const thread = await resolveThreadById(threadId, { preferFresh: true });
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  if (!(await memberCanPostToThread(uid, thread))) {
    return NextResponse.json({ error: "You cannot post to this thread" }, { status: 403 });
  }

  const created = await addChatMessage({
    threadId: thread.id,
    authorRole: "member",
    authorId: uid,
    authorName,
    kind: "text",
    body: message,
  });

  return NextResponse.json({ ok: true, message: created });
}