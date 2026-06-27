import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { removeSelfRegisteredMemberByEmail } from "@/lib/member-accounts-store";
import { removeMemberProfiles } from "@/lib/member-profiles-store";
import { removeWaitlistByEmail } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
});

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const removed = await removeSelfRegisteredMemberByEmail(parsed.data.email);
  if (!removed) {
    return NextResponse.json({ error: "No self-registered account found for that email." }, { status: 404 });
  }

  const profilesRemoved = await removeMemberProfiles([removed.userId]);
  const waitlistRemoved = await removeWaitlistByEmail(removed.email);

  return NextResponse.json({
    ok: true,
    removed: {
      email: removed.email,
      userId: removed.userId,
      profilesRemoved,
      waitlistRemoved,
    },
  });
}