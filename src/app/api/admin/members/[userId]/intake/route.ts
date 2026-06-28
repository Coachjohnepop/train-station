import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function POST(_request: Request, { params }: Params) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const existing = await getMemberProfile(userId);
  if (!existing) {
    return NextResponse.json({ error: "Member profile not found." }, { status: 404 });
  }

  const completedAt = new Date().toISOString();
  const profile = await updateMemberProfile(userId, {
    coachIntakeCompleteAt: completedAt,
    coachIntakeCompletedBy: session.email,
  });

  return NextResponse.json({ ok: true, profile });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const profile = await updateMemberProfile(userId, {
    coachIntakeCompleteAt: null,
    coachIntakeCompletedBy: null,
  });

  return NextResponse.json({ ok: true, profile });
}