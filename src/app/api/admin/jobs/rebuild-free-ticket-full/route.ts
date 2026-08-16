import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { getLandingMedia } from "@/lib/landing-media-store";
import { triggerRebuildFreeTicketFull } from "@/lib/free-ticket-full-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }
  const config = await getLandingMedia();
  return NextResponse.json({
    status: config.freeTicketFullStatus,
    url: config.freeTicketFullUrl,
    builtAt: config.freeTicketFullBuiltAt,
    introSource: config.freeTicketFullIntroSource,
    error: config.freeTicketFullError,
  });
}

export async function POST() {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }
  const config = await getLandingMedia();
  const introUrl = config.freeChastiseVideoUrl;
  if (!introUrl) {
    return NextResponse.json({ error: "No Free Explorer intro to concat." }, { status: 400 });
  }
  const result = await triggerRebuildFreeTicketFull({
    introUrl,
    reason: "admin-manual",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
