import { NextResponse } from "next/server";
import {
  ensureCohortThread,
  ensureMemberThread,
  getUnreadCountsByThreadForCoach,
  getUnreadCountsByThreadForMember,
  hydrateCoachChat,
  listThreadsForCoach,
  listThreadsForMember,
} from "@/lib/coach-chat";
import { COMMUNITY_FEED_PROGRAM_SLUG, COMMUNITY_FEED_TITLE } from "@/lib/community-feed";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { assertUserScope } from "@/lib/api-auth";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  if (!memberId) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }

  const scope = assertUserScope(session, memberId);
  if (scope) {
    if (!isStaffRole(session.role)) return scope;
  }

  await hydrateCoachChat({ preferFresh: true });
  const thread = await ensureMemberThread(memberId);
  return NextResponse.json({ thread });
}

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "member";
  const programSlugs = searchParams.get("programs")?.split(",").filter(Boolean) || ["adult"];

  await hydrateCoachChat({ preferFresh: true });

  if (role === "coach") {
    if (!isStaffRole(session.role)) {
      return NextResponse.json({ error: "Coach access required." }, { status: 403 });
    }
    return NextResponse.json({
      threads: listThreadsForCoach(),
      unreadByThread: getUnreadCountsByThreadForCoach(),
    });
  }

  if (session.role !== "MEMBER") {
    return NextResponse.json({ error: "Member access required." }, { status: 403 });
  }

  const uid = session.id;
  await ensureMemberThread(uid);
  await ensureCohortThread(COMMUNITY_FEED_PROGRAM_SLUG, COMMUNITY_FEED_TITLE);
  const slugs = [...new Set([COMMUNITY_FEED_PROGRAM_SLUG, ...programSlugs])];
  return NextResponse.json(
    {
      threads: listThreadsForMember(uid, slugs),
      unreadByThread: getUnreadCountsByThreadForMember(uid, slugs),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
