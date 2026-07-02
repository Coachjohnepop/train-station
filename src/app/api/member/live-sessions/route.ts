import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { getMemberLiveSessions } from "@/lib/booking";
import { zoomConfigured } from "@/lib/zoom";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const sessions = await getMemberLiveSessions({
    memberEmail: auth.session.email,
    userId: auth.session.id,
  });

  return NextResponse.json({
    sessions,
    zoomConfigured: zoomConfigured(),
  });
}