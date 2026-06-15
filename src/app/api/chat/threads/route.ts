import { NextResponse } from "next/server";
import {
  ensureMemberThread,
  hydrateCoachChat,
  listThreadsForCoach,
  listThreadsForMember,
} from "@/lib/coach-chat";
import { resolveUserId } from "@/lib/current-user";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  if (!memberId) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }

  await hydrateCoachChat();
  const thread = await ensureMemberThread(memberId);
  return NextResponse.json({ thread });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "member";
  const programSlugs = searchParams.get("programs")?.split(",").filter(Boolean) || ["adult"];

  await hydrateCoachChat();

  if (role === "coach") {
    return NextResponse.json({ threads: listThreadsForCoach() });
  }

  const uid = await resolveUserId();
  return NextResponse.json({ threads: listThreadsForMember(uid, programSlugs) });
}