import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole, syncMemberGateCookies } from "@/lib/auth";
import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";

type RouteContext = { params: Promise<{ userId: string }> };

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await context.params;
  const profile = await getMemberProfile(userId);
  if (!profile) {
    return NextResponse.json({ error: "Member profile not found." }, { status: 404 });
  }

  const approvedAt = new Date().toISOString();
  const updated = await updateMemberProfile(userId, {
    approvalStatus: "approved",
    approvedAt,
  });

  const res = NextResponse.json({ ok: true, profile: updated });
  syncMemberGateCookies(res, { userId, profile: updated });
  return res;
}