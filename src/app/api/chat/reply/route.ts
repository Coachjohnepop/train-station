import { NextResponse } from "next/server";
import { addChatMessage, ensureMemberThread } from "@/lib/coach-chat";
import { resolveUserId } from "@/lib/current-user";
import { resolveDemoUser } from "@/lib/demo-user-directory";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (message.length < 1) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const uid = await resolveUserId("demo-user");
  const user = resolveDemoUser(uid);
  const thread = ensureMemberThread(uid);

  const created = addChatMessage({
    threadId: thread.id,
    authorRole: "member",
    authorId: uid,
    authorName: user?.name || "Member",
    kind: "text",
    body: message,
  });

  return NextResponse.json({ ok: true, message: created });
}