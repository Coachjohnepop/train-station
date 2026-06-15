import { NextResponse } from "next/server";
import { getUnreadCountForCoach, getUnreadCountForMember, hydrateCoachChat } from "@/lib/coach-chat";
import { resolveUserId } from "@/lib/current-user";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "member";
  const programs = searchParams.get("programs")?.split(",").filter(Boolean) || ["adult"];

  await hydrateCoachChat();

  if (role === "coach") {
    return NextResponse.json({ unread: getUnreadCountForCoach() });
  }

  const uid = await resolveUserId();
  return NextResponse.json({ unread: getUnreadCountForMember(uid, programs) });
}