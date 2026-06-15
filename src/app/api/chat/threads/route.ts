import { NextResponse } from "next/server";
import { hydrateCoachChat, listThreadsForCoach, listThreadsForMember } from "@/lib/coach-chat";
import { resolveUserId } from "@/lib/current-user";

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