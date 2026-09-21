import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  appendPaymentNote,
  memberDisplayName,
  notifyBusinessUpgradeAdmins,
} from "@/lib/business-upgrade-request";
import { getAccountByUserId } from "@/lib/member-accounts-store";
import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

const schema = z.object({
  action: z.enum(["approve", "decline"]),
  note: z.string().max(500).optional(),
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
  const profile = await getMemberProfile(userId);
  if (!profile) {
    return NextResponse.json({ error: "Member profile not found." }, { status: 404 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose approve or decline." }, { status: 400 });
  }

  if (profile.businessUpgradeStatus !== "pending") {
    return NextResponse.json(
      { error: "No pending Business Class upgrade request for this member." },
      { status: 409 },
    );
  }

  const actorEmail = session.email || session.id;
  const nowIso = new Date().toISOString();
  const account = await getAccountByUserId(userId);
  const memberName = memberDisplayName(profile.email, account?.account.name);
  const hasStripeSubscription = Boolean(profile.stripeSubscriptionId);

  if (parsed.data.action === "decline") {
    const updated = await updateMemberProfile(userId, {
      businessUpgradeStatus: "declined",
      businessUpgradeReviewedAt: nowIso,
      businessUpgradeReviewedBy: actorEmail,
      paymentNote: appendPaymentNote(
        profile.paymentNote,
        parsed.data.note?.trim() ||
          `Business Class upgrade declined ${nowIso.slice(0, 10)} by ${actorEmail}`,
      ),
    });
    const notify = await notifyBusinessUpgradeAdmins({
      event: "declined",
      memberName,
      memberEmail: updated.email,
      actorEmail,
      hasStripeSubscription,
      note: parsed.data.note?.trim() || null,
    });
    return NextResponse.json({
      ok: true,
      status: "declined" as const,
      profile: updated,
      notify,
    });
  }

  const note =
    parsed.data.note?.trim() ||
    `Business Class upgrade approved ${nowIso.slice(0, 10)} by ${actorEmail} · complimentary, Stripe price unchanged`;

  const updated = await updateMemberProfile(userId, {
    plan: "business",
    businessUpgradeStatus: "approved",
    businessUpgradeReviewedAt: nowIso,
    businessUpgradeReviewedBy: actorEmail,
    paymentNote: appendPaymentNote(profile.paymentNote, note),
  });

  const notify = await notifyBusinessUpgradeAdmins({
    event: "approved",
    memberName,
    memberEmail: updated.email,
    actorEmail,
    hasStripeSubscription,
    note,
    extraLines: [
      "Complimentary seat. Stripe billing was not changed.",
      "Buying Business Class at checkout is still $50/mo.",
    ],
  });

  return NextResponse.json({
    ok: true,
    status: "approved" as const,
    stripeChanged: false,
    profile: updated,
    notify,
    message: `${memberName} is on Business Class. Their Stripe price stays the same.`,
  });
}
