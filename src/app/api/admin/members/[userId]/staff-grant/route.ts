import { NextResponse } from "next/server";
import { z } from "zod";
import { actorFromSession, clientIpFromRequest, userAgentFromRequest } from "@/lib/audit-request";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { attachPaidMemberCookies, markMemberPaid } from "@/lib/mark-member-paid";
import { PAID_MEMBERSHIP_PLANS, signupPlanLabel } from "@/lib/signup-plans";
import {
  isStandingStaffGrantEmail,
  notifyStaffGrantAdmins,
  staffGrantExpiryIsoForEmail,
} from "@/lib/staff-grants";

type RouteContext = { params: Promise<{ userId: string }> };

const schema = z.object({
  plan: z.enum(["member", "business", "pro"]),
  note: z.string().max(500).optional(),
  completeOnboarding: z.boolean().optional().default(true),
});

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

/**
 * Staff grant: set membership tier + mark paid (manual) without Stripe.
 * Expires on the 1st of next month — reapprove via this same endpoint.
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await context.params;
  const profile = await getMemberProfile(userId);
  if (!profile) {
    return NextResponse.json({ error: "Member profile not found." }, { status: 404 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Choose a paid plan (Coach Class, Business Class, or 1st Class).",
        detail: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const plan = parsed.data.plan;
  if (!(PAID_MEMBERSHIP_PLANS as readonly string[]).includes(plan)) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  const planLabel = signupPlanLabel(plan);
  const actorEmail = session.email || session.id;
  const standing = isStandingStaffGrantEmail(profile.email);
  const expiresAt = staffGrantExpiryIsoForEmail(profile.email);
  const reapprove = Boolean(profile.staffGrantedAt || profile.staffGrantExpiresAt);
  const note =
    parsed.data.note?.trim() ||
    (standing
      ? `Standing staff grant · ${planLabel} · ${actorEmail} · auto-renew`
      : `Staff grant · ${planLabel} · ${actorEmail} · reapprove by 1st of month`);

  let updated = await markMemberPaid({
    userId,
    plan,
    method: "manual",
    note,
    actor: actorFromSession(session),
    auditSource: reapprove ? "admin.staff_grant_reapprove" : "admin.staff_grant",
    ip: clientIpFromRequest(request),
    userAgent: userAgentFromRequest(request),
  });

  if (!updated) {
    return NextResponse.json({ error: "Could not apply staff grant." }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  updated = await updateMemberProfile(userId, {
    staffGrantExpiresAt: expiresAt,
    staffGrantedAt: nowIso,
    staffGrantedBy: actorEmail,
    paymentNote: note,
    ...(parsed.data.completeOnboarding && !updated.onboardingComplete
      ? {
          onboardingComplete: true,
          completedAt: updated.completedAt || nowIso,
          approvalStatus: "approved" as const,
          approvedAt: updated.approvedAt || nowIso,
        }
      : {}),
  });

  const notify = await notifyStaffGrantAdmins({
    event: reapprove ? "reapproved" : "granted",
    memberName: updated.email.split("@")[0] || updated.email,
    memberEmail: updated.email,
    plan: updated.plan,
    expiresAt: updated.staffGrantExpiresAt,
    note: updated.paymentNote,
    actorEmail,
  });

  // Prefer display name from accounts if we only have email
  const res = NextResponse.json({
    ok: true,
    profile: updated,
    message: standing
      ? `${planLabel} stays granted for ${profile.email} (standing, auto-renew).`
      : reapprove
        ? `Reapproved ${planLabel} through ${new Date(expiresAt).toLocaleDateString()}.`
        : `Granted ${planLabel} (manual). Reapprove on the 1st of each month.`,
    notify,
    expiresAt,
  });
  await attachPaidMemberCookies(res, userId, updated);
  return res;
}
