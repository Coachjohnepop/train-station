import { NextResponse } from "next/server";
import {
  ensureMemberThread,
  getUnreadCountsByThreadForCoach,
  hydrateCoachChat,
  listThreadsForCoach,
  listThreadsForMember,
} from "@/lib/coach-chat";
import { resolveMemberUserId } from "@/lib/current-user";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  if (!memberId) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }

  await hydrateCoachChat({ preferFresh: true });
  const thread = await ensureMemberThread(memberId);
  return NextResponse.json({ thread });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "member";
  const programSlugs = searchParams.get("programs")?.split(",").filter(Boolean) || ["adult"];

  await hydrateCoachChat({ preferFresh: true });

  if (role === "coach") {
    return NextResponse.json({
      threads: listThreadsForCoach(),
      unreadByThread: getUnreadCountsByThreadForCoach(),
    });
  }

  const uid = await resolveMemberUserId();
  return NextResponse.json(
    { threads: listThreadsForMember(uid, programSlugs) },
    { headers: { "Cache-Control": "no-store" } },
  );
}