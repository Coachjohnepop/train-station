import { NextResponse } from "next/server";
import { z } from "zod";
import { actorFromSession, clientIpFromRequest, userAgentFromRequest } from "@/lib/audit-request";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { attachPaidMemberCookies, markMemberPaid } from "@/lib/mark-member-paid";

type RouteContext = { params: Promise<{ userId: string }> };

const schema = z.object({
  method: z.enum(["venmo", "manual", "stripe", "other"]).optional(),
  note: z.string().max(500).optional(),
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
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const method = parsed.data.method ?? "manual";
  if (method === "stripe") {
    return NextResponse.json(
      { error: "Stripe payments must be confirmed via webhook or checkout return." },
      { status: 400 },
    );
  }

  const updated = await markMemberPaid({
    userId,
    method,
    note: parsed.data.note ?? null,
    actor: actorFromSession(session),
    auditSource: "admin.mark_paid",
    ip: clientIpFromRequest(request),
    userAgent: userAgentFromRequest(request),
  });

  const res = NextResponse.json({ ok: true, profile: updated });
  await attachPaidMemberCookies(res, userId, updated);
  return res;
}