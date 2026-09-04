import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { addChatMessage, ensureMemberThread, hydrateCoachChat } from "@/lib/coach-chat";
import { notifyCoachZoomWaiting } from "@/lib/coach-member-notify";
import { getAccountByUserId } from "@/lib/member-accounts-store";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { localTodayIso } from "@/lib/program-calendar";

export const dynamic = "force-dynamic";

export const ZOOM_READY_PING_MESSAGE = "Coach, Members are ready";

export async function POST(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  let sessionDate = localTodayIso();
  try {
    const body = await request.json();
    if (typeof body?.sessionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.sessionDate)) {
      sessionDate = body.sessionDate;
    }
  } catch {
    /* optional body */
  }

  const uid = auth.session.id;
  const user = resolveDemoUser(uid);
  const registered = user ? null : await getAccountByUserId(uid);
  const authorName =
    auth.session.name?.trim() ||
    user?.name ||
    registered?.account.name ||
    registered?.email ||
    "Member";

  await hydrateCoachChat({ preferFresh: true });
  const thread = await ensureMemberThread(uid);
  const created = await addChatMessage({
    threadId: thread.id,
    authorRole: "member",
    authorId: uid,
    authorName,
    kind: "text",
    body: ZOOM_READY_PING_MESSAGE,
  });

  await notifyCoachZoomWaiting({
    userId: uid,
    name: authorName,
    email: auth.session.email,
    sessionDate,
    reason: "ping",
  });

  return NextResponse.json({ ok: true, message: created, body: ZOOM_READY_PING_MESSAGE });
}
