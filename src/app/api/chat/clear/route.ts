import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { hydrateCoachChat, resolveThreadById } from "@/lib/coach-chat";
import { assertChatThreadAccess } from "@/lib/chat-thread-access";
import { clearThreadForMember } from "@/lib/chat-thread-cursor";

export const dynamic = "force-dynamic";

const schema = z.object({
  threadId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "threadId required." }, { status: 400 });
  }

  await hydrateCoachChat({ preferFresh: true });
  const thread = await resolveThreadById(parsed.data.threadId);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }

  const access = await assertChatThreadAccess(thread, { role: "member" });
  if (!access.ok) return access.response;

  const memberId = access.memberId || session.id;
  if (!memberId) {
    return NextResponse.json({ error: "Member required." }, { status: 403 });
  }
  if (session.role !== "MEMBER" && !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Member required." }, { status: 403 });
  }

  const clearedAt = await clearThreadForMember(memberId, thread.id);
  return NextResponse.json({ ok: true, threadId: thread.id, clearedAt });
}
