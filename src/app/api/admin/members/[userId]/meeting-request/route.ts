import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

const bodySchema = z.object({
  note: z.string().max(200).optional(),
});

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function POST(request: Request, { params }: Params) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const existing = await getMemberProfile(userId);
  if (!existing) {
    return NextResponse.json({ error: "Member profile not found." }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const note = parsed.success ? parsed.data.note?.trim() : undefined;

  const profile = await updateMemberProfile(userId, {
    coachMeetingRequestedAt: new Date().toISOString(),
    coachMeetingRequestedBy: session.email,
    coachMeetingRequestNote: note || "Coach requested a follow-up call",
  });

  return NextResponse.json({ ok: true, profile });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const profile = await updateMemberProfile(userId, {
    coachMeetingRequestedAt: null,
    coachMeetingRequestedBy: null,
    coachMeetingRequestNote: null,
  });

  return NextResponse.json({ ok: true, profile });
}