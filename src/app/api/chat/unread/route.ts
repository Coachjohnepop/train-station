import { NextResponse } from "next/server";
import { getUnreadCountForCoach, getUnreadCountForMember, hydrateCoachChat } from "@/lib/coach-chat";
import { getSessionUser, isStaffRole } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "member";
  const programs = searchParams.get("programs")?.split(",").filter(Boolean) || ["adult"];

  await hydrateCoachChat();

  if (role === "coach") {
    if (!isStaffRole(session.role)) {
      return NextResponse.json({ error: "Coach access required." }, { status: 403 });
    }
    return NextResponse.json({ unread: getUnreadCountForCoach() });
  }

  if (session.role !== "MEMBER") {
    return NextResponse.json({ error: "Member access required." }, { status: 403 });
  }

  const uid = session.id;
  return NextResponse.json({ unread: getUnreadCountForMember(uid, programs) });
}