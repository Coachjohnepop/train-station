import "server-only";

import type { ChatThread } from "@/lib/coach-chat";
import { memberCanPostToThread } from "@/lib/coach-chat";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { NextResponse } from "next/server";

export { memberCanPostToThread as memberCanAccessThread };

/** Members may read/post only on threads they belong to; staff may access any thread. */
export async function assertChatThreadAccess(
  thread: ChatThread,
  options?: { role?: "coach" | "member" },
): Promise<
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>; memberId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await getSessionUser();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }

  const role = options?.role === "coach" ? "coach" : "member";
  if (role === "coach") {
    if (!isStaffRole(session.role)) {
      return { ok: false, response: NextResponse.json({ error: "Coach access required." }, { status: 403 }) };
    }
    return { ok: true, session, memberId: session.id };
  }

  if (isStaffRole(session.role)) {
    return { ok: true, session, memberId: session.id };
  }

  if (session.role !== "MEMBER") {
    return { ok: false, response: NextResponse.json({ error: "Member access required." }, { status: 403 }) };
  }

  if (!(await memberCanPostToThread(session.id, thread))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "You cannot access this thread." }, { status: 403 }),
    };
  }

  return { ok: true, session, memberId: session.id };
}