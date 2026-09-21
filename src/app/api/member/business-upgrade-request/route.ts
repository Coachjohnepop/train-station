import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ordinalPlace } from "@/lib/business-upgrade";
import {
  appendPaymentNote,
  canRequestBusinessClassUpgrade,
  memberDisplayName,
  notifyBusinessUpgradeAdmins,
} from "@/lib/business-upgrade-request";
import { getAccountByUserId } from "@/lib/member-accounts-store";
import {
  getBusinessUpgradeQueuePlaceForUser,
  getMemberProfile,
  updateMemberProfile,
} from "@/lib/member-profiles-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const profile = await getMemberProfile(session.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const status = profile.businessUpgradeStatus === "pending" ? "pending" : profile.businessUpgradeStatus;
  const place =
    status === "pending" ? await getBusinessUpgradeQueuePlaceForUser(session.id) : null;

  return NextResponse.json({
    ok: true,
    status: status || null,
    requestedAt: profile.businessUpgradeRequestedAt,
    position: place?.position ?? null,
    size: place?.size ?? null,
    ahead: place?.ahead ?? null,
  });
}

export async function POST() {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const profile = await getMemberProfile(session.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  if (profile.businessUpgradeStatus === "pending") {
    const place = await getBusinessUpgradeQueuePlaceForUser(session.id);
    return NextResponse.json({
      ok: true,
      alreadyRequested: true,
      status: "pending" as const,
      requestedAt: profile.businessUpgradeRequestedAt,
      position: place?.position ?? null,
      size: place?.size ?? null,
      ahead: place?.ahead ?? null,
    });
  }

  if (!canRequestBusinessClassUpgrade(profile)) {
    return NextResponse.json(
      {
        error:
          profile.plan !== "member"
            ? "Business Class upgrade requests are for paid Coach Class tickets."
            : profile.paymentStatus !== "paid"
              ? "Finish Coach Class payment first, then request the upgrade."
              : "This upgrade is already approved.",
      },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();
  const updated = await updateMemberProfile(session.id, {
    businessUpgradeRequestedAt: nowIso,
    businessUpgradeStatus: "pending",
    businessUpgradeReviewedAt: null,
    businessUpgradeReviewedBy: null,
    paymentNote: appendPaymentNote(
      profile.paymentNote,
      `Business Class upgrade requested ${nowIso.slice(0, 10)}`,
    ),
  });

  const place = await getBusinessUpgradeQueuePlaceForUser(session.id);
  const account = await getAccountByUserId(session.id);
  const memberName = memberDisplayName(updated.email, account?.account.name);
  const notify = await notifyBusinessUpgradeAdmins({
    event: "requested",
    memberName,
    memberEmail: updated.email,
    hasStripeSubscription: Boolean(updated.stripeSubscriptionId),
    extraLines: [
      place
        ? `Queue: ${ordinalPlace(place.position)} of ${place.size} (${place.ahead} ahead).`
        : null,
      "Airline-style request — do not auto-upgrade. Approve in Admin → Members.",
    ].filter(Boolean) as string[],
  });

  return NextResponse.json({
    ok: true,
    status: "pending" as const,
    requestedAt: updated.businessUpgradeRequestedAt,
    position: place?.position ?? null,
    size: place?.size ?? null,
    ahead: place?.ahead ?? null,
    notify,
  });
}
