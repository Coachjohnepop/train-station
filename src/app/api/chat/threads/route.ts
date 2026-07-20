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
import {
  COMMUNITY_FEED_PROGRAM_SLUG,
  COMMUNITY_FEED_TITLE,
  STATION_COMMUNITY_SLUG,
  STATION_COMMUNITY_TITLE,
  alwaysOnCommunitySlugs,
  cohortTitleForSlug,
} from "@/lib/community-feed";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { assertUserScope } from "@/lib/api-auth";
import { getUserEnrollments } from "@/lib/data/user-data";

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

/** Station + legacy community + optional query programs + live enrollments. */
async function resolveMemberProgramSlugs(uid: string, queryPrograms: string[]): Promise<string[]> {
  const enrolled = Object.keys(await getUserEnrollments(uid));
  return [...new Set([...alwaysOnCommunitySlugs(), ...queryPrograms, ...enrolled])];
}

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "member";
  const queryPrograms = searchParams.get("programs")?.split(",").filter(Boolean) || [];

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

  // Real members + staff previewing member Messages (Coach John testing, etc.)
  if (session.role !== "MEMBER" && !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Member access required." }, { status: 403 });
  }

  const uid = session.id;
  await ensureMemberThread(uid);
  await ensureCohortThread(STATION_COMMUNITY_SLUG, STATION_COMMUNITY_TITLE);
  await ensureCohortThread(COMMUNITY_FEED_PROGRAM_SLUG, COMMUNITY_FEED_TITLE);
  const slugs = await resolveMemberProgramSlugs(uid, queryPrograms);
  for (const slug of slugs) {
    if (slug === STATION_COMMUNITY_SLUG || slug === COMMUNITY_FEED_PROGRAM_SLUG) continue;
    await ensureCohortThread(slug, cohortTitleForSlug(slug));
  }

  // Staff testing: also surface all cohort threads so John can post to any group.
  if (isStaffRole(session.role)) {
    const all = listThreadsForCoach();
    const memberish = listThreadsForMember(uid, slugs);
    const byId = new Map(memberish.map((t) => [t.id, t]));
    for (const t of all) {
      if (t.kind === "cohort" && !byId.has(t.id)) byId.set(t.id, t);
    }
    const threads = [...byId.values()].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return NextResponse.json(
      {
        threads,
        unreadByThread: getUnreadCountsByThreadForMember(uid, slugs),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      threads: listThreadsForMember(uid, slugs),
      unreadByThread: getUnreadCountsByThreadForMember(uid, slugs),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
