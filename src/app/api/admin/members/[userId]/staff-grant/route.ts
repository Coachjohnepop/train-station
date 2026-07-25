import { NextResponse } from "next/server";
import { z } from "zod";
import { actorFromSession, clientIpFromRequest, userAgentFromRequest } from "@/lib/audit-request";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { attachPaidMemberCookies, markMemberPaid } from "@/lib/mark-member-paid";
import { PAID_MEMBERSHIP_PLANS, signupPlanLabel } from "@/lib/signup-plans";

type RouteContext = { params: Promise<{ userId: string }> };

const schema = z.object({
  /** Coach Class | Business Class | 1st Class */
  plan: z.enum(["member", "business", "pro"]),
  note: z.string().max(500).optional(),
  /** Default true — unlock Today / training without forcing full onboard wizard again. */
  completeOnboarding: z.boolean().optional().default(true),
});

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

/**
 * Staff grant: set membership tier + mark paid (manual) without Stripe.
 * Used for comps, beta, “grey maintain” Coach Class, Business+ previews, etc.
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
  const note =
    parsed.data.note?.trim() ||
    `Staff grant · ${planLabel} · ${session.email || session.id}`;

  let updated = await markMemberPaid({
    userId,
    plan,
    method: "manual",
    note,
    actor: actorFromSession(session),
    auditSource: "admin.staff_grant",
    ip: clientIpFromRequest(request),
    userAgent: userAgentFromRequest(request),
  });

  if (!updated) {
    return NextResponse.json({ error: "Could not apply staff grant." }, { status: 500 });
  }

  if (parsed.data.completeOnboarding && !updated.onboardingComplete) {
    updated = await updateMemberProfile(userId, {
      onboardingComplete: true,
      completedAt: updated.completedAt || new Date().toISOString(),
      approvalStatus: "approved",
      approvedAt: updated.approvedAt || new Date().toISOString(),
    });
  }

  const res = NextResponse.json({
    ok: true,
    profile: updated,
    message: `Granted ${planLabel} (manual / staff).`,
  });
  await attachPaidMemberCookies(res, userId, updated);
  return res;
}
