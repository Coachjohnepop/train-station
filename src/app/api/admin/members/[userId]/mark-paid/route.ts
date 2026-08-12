import { NextResponse } from "next/server";
import { z } from "zod";
import { recordSubscriptionPaymentFact } from "@/lib/analytics-facts";
import { actorFromSession, clientIpFromRequest, userAgentFromRequest } from "@/lib/audit-request";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { attachPaidMemberCookies, markMemberPaid } from "@/lib/mark-member-paid";

type RouteContext = { params: Promise<{ userId: string }> };

const schema = z.object({
  method: z.enum(["venmo", "manual", "other"]).optional(),
  note: z.string().max(500).optional(),
  /** Dollars received (Venmo / cash). Required so books stay complete for net-new. */
  amountDollars: z.number().positive().max(50_000).optional(),
  /** Prefer cents when UI already converted. */
  amountCents: z.number().int().positive().max(5_000_000).optional(),
});

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

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
      { error: "Invalid request. Enter a payment amount (dollars) for Venmo/manual." },
      { status: 400 },
    );
  }

  const method = parsed.data.method ?? "manual";
  let amountCents = parsed.data.amountCents ?? null;
  if (amountCents == null && parsed.data.amountDollars != null) {
    amountCents = Math.round(parsed.data.amountDollars * 100);
  }
  if (amountCents == null || amountCents <= 0) {
    return NextResponse.json(
      {
        error:
          "Amount is required for Mark paid (e.g. 25 for $25 Venmo). Keeps Accounting books accurate.",
      },
      { status: 400 },
    );
  }

  const note = parsed.data.note ?? null;
  const updated = await markMemberPaid({
    userId,
    method,
    note,
    amountCents,
    currency: "usd",
    actor: actorFromSession(session),
    auditSource: "admin.mark_paid",
    ip: clientIpFromRequest(request),
    userAgent: userAgentFromRequest(request),
  });

  await recordSubscriptionPaymentFact({
    userId,
    amountCents,
    currency: "usd",
    status: "paid",
    planId: updated?.plan ?? profile.plan,
    tierSlug: updated?.plan ?? profile.plan,
    billingReason: method === "venmo" ? "venmo_manual" : "admin_mark_paid",
    paidAt: new Date(),
    properties: {
      kind: "admin_mark_paid",
      method,
      note,
      markedBy: session.email,
      source: "admin.mark_paid",
    },
  });

  const res = NextResponse.json({
    ok: true,
    profile: updated,
    amountCents,
    amountLabel: `$${(amountCents / 100).toFixed(2)}`,
  });
  await attachPaidMemberCookies(res, userId, updated);
  return res;
}