import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/database-config";
import { listMemberProfiles, updateMemberProfile } from "@/lib/member-profiles-store";
import { signupPlanLabel } from "@/lib/signup-plans";
import {
  isStaffGrantExpired,
  isStandingStaffGrantEmail,
  notifyStaffGrantAdmins,
  staffGrantNotifyEmails,
  standingStaffGrantExpiryIso,
} from "@/lib/staff-grants";
import { sendResendEmail } from "@/lib/resend-mail";
import { BRAND_NAME } from "@/lib/brand";
import { localTodayIso } from "@/lib/program-calendar";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim() || process.env.STAFF_GRANT_CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://www.thetrainstation.co"
  );
}

/**
 * Daily: expire staff grants past staffGrantExpiresAt (1st-of-month windows).
 * On the 1st (app TZ): also email John + Jeremy a digest of who needs reapproval.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, detail: "no database" });
  }

  const profiles = await listMemberProfiles();
  const now = new Date();
  const todayIso = localTodayIso(now);
  const isFirstOfMonth = todayIso.endsWith("-01") || todayIso.slice(8) === "01";

  const expired: Array<{
    userId: string;
    email: string;
    plan: string;
    expiresAt: string | null;
  }> = [];

  for (const p of profiles) {
    if (isStandingStaffGrantEmail(p.email)) {
      const expMs = p.staffGrantExpiresAt
        ? new Date(p.staffGrantExpiresAt).getTime()
        : 0;
      const needsRoll =
        p.paymentStatus !== "paid" ||
        !p.staffGrantExpiresAt ||
        expMs - now.getTime() < 60 * 24 * 60 * 60 * 1000;
      if (needsRoll) {
        const expiresAt = standingStaffGrantExpiryIso(now);
        await updateMemberProfile(p.userId, {
          paymentStatus: "paid",
          paymentMethod: "manual",
          staffGrantExpiresAt: expiresAt,
          staffGrantedAt: now.toISOString(),
          staffGrantedBy: "standing-auto-renew",
          paymentNote: [
            p.paymentNote || "Standing staff grant",
            `Auto-renewed ${todayIso}`,
          ]
            .filter(Boolean)
            .join(" · "),
        });
      }
      continue;
    }
    if (p.paymentMethod !== "manual") continue;
    if (!p.staffGrantExpiresAt && !p.staffGrantedAt) continue;
    if (!isStaffGrantExpired(p, now)) continue;
    if (p.paymentStatus !== "paid") {
      // Already unpaid but still has grant metadata — still list for digest
      expired.push({
        userId: p.userId,
        email: p.email,
        plan: p.plan,
        expiresAt: p.staffGrantExpiresAt,
      });
      continue;
    }

    await updateMemberProfile(p.userId, {
      paymentStatus: "pending",
      paymentNote: [
        p.paymentNote || "Staff grant",
        `Expired ${todayIso} — reapprove in Admin → Members`,
      ]
        .filter(Boolean)
        .join(" · "),
    });

    expired.push({
      userId: p.userId,
      email: p.email,
      plan: p.plan,
      expiresAt: p.staffGrantExpiresAt,
    });

    await notifyStaffGrantAdmins({
      event: "expired",
      memberName: p.email.split("@")[0] || p.email,
      memberEmail: p.email,
      plan: p.plan,
      expiresAt: p.staffGrantExpiresAt,
      note: p.paymentNote,
      extraLines: ["Access is locked until an admin reapproves the staff grant."],
    });
  }

  let digestSent = 0;
  if (isFirstOfMonth || expired.length > 0) {
    const needing = profiles.filter(
      (p) =>
        p.paymentMethod === "manual" &&
        (p.staffGrantedAt || p.staffGrantExpiresAt) &&
        (isStaffGrantExpired(p, now) || p.paymentStatus !== "paid"),
    );
    if (needing.length > 0 || isFirstOfMonth) {
      const membersUrl = `${appBaseUrl()}/admin/members`;
      const body = [
        isFirstOfMonth
          ? `Monthly staff-grant reapproval (${todayIso})`
          : `Staff grants expired (${todayIso})`,
        "",
        needing.length === 0
          ? "No staff grants currently need reapproval."
          : needing
              .map(
                (p) =>
                  `• ${p.email} · ${signupPlanLabel(p.plan)} · expired ${
                    p.staffGrantExpiresAt
                      ? new Date(p.staffGrantExpiresAt).toLocaleDateString()
                      : "?"
                  }`,
              )
              .join("\n"),
        "",
        `Reapprove: ${membersUrl}`,
      ].join("\n");

      for (const to of staffGrantNotifyEmails()) {
        const ok = await sendResendEmail({
          to,
          subject: `Staff grants · reapprove (${needing.length}) — ${BRAND_NAME}`,
          text: body,
          ctaUrl: membersUrl,
          ctaLabel: "Open Admin Members",
          tags: [
            { name: "category", value: "staff-grant" },
            { name: "event", value: "digest" },
          ],
        });
        if (ok) digestSent += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    todayIso,
    isFirstOfMonth,
    expired: expired.length,
    expiredMembers: expired,
    digestSent,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
