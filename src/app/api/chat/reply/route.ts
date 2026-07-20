import { NextResponse } from "next/server";
import {
  addChatMessage,
  COACH_READER_ID,
  ensureMemberThread,
  hydrateCoachChat,
  memberCanPostToThread,
  resolveThreadById,
} from "@/lib/coach-chat";
import { isAllowedChatMediaUrl } from "@/lib/chat-compose-auth";
import { getSessionUser, isStaffRole } from "@/lib/auth";

import { coachDisplayName } from "@/lib/demo-coach";
import { getAccountByUserId } from "@/lib/member-accounts-store";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { sendCoachReplySms } from "@/lib/sms";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  let role: "coach" | "member" = body.role === "coach" ? "coach" : "member";
  const threadId = typeof body.threadId === "string" ? body.threadId : "";
  // Default OFF — SMS is parked; only send when client explicitly sets true.
  const sendSms = body.sendSms === true;
  const imageUrlRaw = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const imageUrl = imageUrlRaw && isAllowedChatMediaUrl(imageUrlRaw) ? imageUrlRaw : "";

  if (imageUrlRaw && !imageUrl) {
    return NextResponse.json({ error: "Invalid image URL — upload the photo in Messages first." }, { status: 400 });
  }

  if (message.length < 1 && !imageUrl) {
    return NextResponse.json({ error: "Message or image is required" }, { status: 400 });
  }

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  // Staff using member Messages UI still posts as coach (John + Jeremy same powers).
  if (role === "member" && isStaffRole(session.role)) {
    role = "coach";
  }

  if (role === "coach") {
    if (!isStaffRole(session.role)) {
      return NextResponse.json({ error: "Coach access required." }, { status: 403 });
    }

    if (!threadId) {
      return NextResponse.json({ error: "threadId is required for coach replies" }, { status: 400 });
    }
    const thread = await resolveThreadById(threadId, { preferFresh: true });
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }
    let created;
    try {
      created = await addChatMessage({
        threadId: thread.id,
        authorRole: "coach",
        authorId: COACH_READER_ID,
        authorName: coachDisplayName(session),
        kind: imageUrl ? "image" : "text",
        body: message || undefined,
        mediaUrl: imageUrl || undefined,
        readByUserIds: [COACH_READER_ID],
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Send failed";
      return NextResponse.json({ error: msg }, { status: 503 });
    }

    let smsResult = { sent: 0 } as Awaited<ReturnType<typeof sendCoachReplySms>>;
    if (sendSms && thread.kind === "member" && thread.memberId) {
      const smsBody = message || (imageUrl ? "Sent a photo in Messages" : "");
      if (smsBody) {
        smsResult = await sendCoachReplySms({
          memberId: thread.memberId,
          message: smsBody,
          coachName: coachDisplayName(session),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: created,
      sms: smsResult,
      twilioLive: smsResult.sent > 0 && !smsResult.simulated,
    });
  }

  if (session.role !== "MEMBER") {
    return NextResponse.json({ error: "Member access required." }, { status: 403 });
  }
  const memberSession = session;

  await hydrateCoachChat({ preferFresh: true });
  const uid = memberSession.id;
  const user = resolveDemoUser(uid);
  const registered = user ? null : await getAccountByUserId(uid);
  const authorName =
    user?.name || registered?.account.name || registered?.email || "Member";

  // Allow legacy/simple clients that omit threadId — post to this member's coach 1:1.
  let resolvedThreadId = threadId;
  if (!resolvedThreadId) {
    const ensured = await ensureMemberThread(uid);
    resolvedThreadId = ensured.id;
  }

  const thread = await resolveThreadById(resolvedThreadId, { preferFresh: true });
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
    kind: imageUrl ? "image" : "text",
    body: message || undefined,
    mediaUrl: imageUrl || undefined,
  });

  return NextResponse.json({ ok: true, message: created });
}