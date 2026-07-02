import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { memberLiveZoomStatus } from "@/lib/live-class-zoom";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const sessionDate = searchParams.get("date") ?? undefined;

  const status = await memberLiveZoomStatus({
    memberEmail: auth.session.email,
    userId: auth.session.id,
    sessionDate,
  });

  return NextResponse.json(status);
}