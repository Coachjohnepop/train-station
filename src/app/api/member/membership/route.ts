import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  formatMembershipPaymentStatus,
  getMemberMembershipSnapshot,
} from "@/lib/member-membership";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const snapshot = await getMemberMembershipSnapshot(session.id);
  if (!snapshot) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  return NextResponse.json({
    ...snapshot,
    statusLabel: formatMembershipPaymentStatus(snapshot),
  });
}