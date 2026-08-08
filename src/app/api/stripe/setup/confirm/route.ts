import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, syncMemberGateCookies } from "@/lib/auth";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { confirmFreeCardSetupSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const schema = z.object({
  sessionId: z.string().min(1),
});

/** Confirm Free Explorer $0 card setup and clear free-PM gate cookie. */
export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "sessionId required." }, { status: 400 });
  }

  const result = await confirmFreeCardSetupSession({
    userId: session.id,
    sessionId: parsed.data.sessionId,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const profile = await getMemberProfile(session.id);
  const redirectTo = profile?.onboardingComplete
    ? "/member/today"
    : "/member/onboard?plan=explorer";

  const res = NextResponse.json({ ok: true, redirectTo });
  await syncMemberGateCookies(res, { userId: session.id, profile });
  return res;
}
