import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getMemberProfile } from "@/lib/member-profiles-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ needsOnboarding: false });
  }

  const profile = await getMemberProfile(session.id);
  if (!profile) {
    return NextResponse.json({ needsOnboarding: true, plan: "explorer" });
  }

  return NextResponse.json({
    needsOnboarding: !profile.onboardingComplete,
    plan: profile.plan,
    profile,
  });
}