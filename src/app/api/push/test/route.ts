import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { sendPushToUserIds } from "@/lib/web-push";

/**
 * Fire a test notification to the signed-in user's registered devices.
 * Used from "Send test alert" so we can verify iOS home-screen delivery.
 */
export async function POST() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  // Members + staff may test their own devices
  if (session.role !== "MEMBER" && !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const stamp = new Date().toISOString().slice(11, 19);
  const result = await sendPushToUserIds([session.id], {
    title: "Train Station",
    body: `Test alert ${stamp}Z — if you see this, closed-app push works.`,
    url: isStaffRole(session.role) ? "/admin/chat" : "/member/chat",
    unread: 1,
    tag: `ts-push-test-${Date.now()}`,
  });

  if (result.sent === 0) {
    return NextResponse.json(
      {
        ok: false,
        sent: 0,
        error:
          "No push subscription for this login. Open the Home Screen app → Enable alerts (force re-enable), then try again.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, sent: result.sent, failed: result.failed });
}
