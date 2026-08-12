import { NextResponse } from "next/server";
import { getUnreadCountForCoach, getUnreadCountForMember, hydrateCoachChat } from "@/lib/coach-chat";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { resolveMemberVisibleCohortSlugs } from "@/lib/member-chat-access";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "member";

  await hydrateCoachChat();

  if (role === "coach") {
    if (!isStaffRole(session.role)) {
      return NextResponse.json({ error: "Coach access required." }, { status: 403 });
    }
    const { getUnreadCountsByThreadForCoach } = await import("@/lib/coach-chat");
    const unreadByThread = getUnreadCountsByThreadForCoach();
    return NextResponse.json({
      unread: getUnreadCountForCoach(),
      unreadByThread,
      threadsWithUnread: Object.keys(unreadByThread).filter((id) => unreadByThread[id] > 0)
        .length,
    });
  }

  // Staff may open member Messages to test; badge as coach inbox when role=member.
  if (session.role !== "MEMBER" && !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Member access required." }, { status: 403 });
  }

  if (isStaffRole(session.role)) {
    return NextResponse.json({ unread: getUnreadCountForCoach() });
  }

  const uid = session.id;
  const programs = await resolveMemberVisibleCohortSlugs(uid);
  return NextResponse.json({ unread: getUnreadCountForMember(uid, programs) });
}
