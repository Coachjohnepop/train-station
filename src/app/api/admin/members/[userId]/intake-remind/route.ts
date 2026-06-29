import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { getAccountByUserId } from "@/lib/member-accounts-store";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { notifyCoachIntakeReady } from "@/lib/coach-member-notify";
import { signupPlanLabel } from "@/lib/signup-plans";

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
  const profile = await getMemberProfile(userId);
  if (!profile) {
    return NextResponse.json({ error: "Member profile not found." }, { status: 404 });
  }

  if (profile.coachIntakeCompleteAt) {
    return NextResponse.json({ error: "Intake already signed off." }, { status: 400 });
  }

  if (!profile.onboardingComplete) {
    return NextResponse.json({ error: "Member has not finished onboarding." }, { status: 400 });
  }

  const account = await getAccountByUserId(userId);
  const channels = await notifyCoachIntakeReady({
    userId,
    name: account?.account.name || profile.email,
    email: profile.email,
    plan: signupPlanLabel(profile.plan),
    paymentStatus: profile.paymentStatus,
  });

  return NextResponse.json({ ok: true, channels });
}