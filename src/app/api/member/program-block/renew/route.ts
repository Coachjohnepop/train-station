import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { renewExpiredProgramBlocks } from "@/lib/data/user-data";
import { getMemberProfile } from "@/lib/member-profiles-store";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const profile = await getMemberProfile(session.id);
  if (profile?.paymentStatus !== "paid") {
    return NextResponse.json(
      { error: "Finish payment first, then start the next 28-day block." },
      { status: 409 },
    );
  }
  const result = await renewExpiredProgramBlocks(session.id);
  return NextResponse.json({ ok: true, ...result });
}
