import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  deleteCommissionPartner,
  getCommissionPartner,
  listCommissionPartners,
  sumEnabledSharePercents,
  updateCommissionPartner,
} from "@/lib/commission-partners-store";
import { getConnectPartnerStatus } from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ partnerId: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email().optional(),
  sharePercent: z.number().min(0).max(100).optional(),
  enabled: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional(),
});

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { partnerId } = await context.params;
  const partner = await getCommissionPartner(partnerId);
  if (!partner) return NextResponse.json({ error: "Partner not found." }, { status: 404 });

  const connect = await getConnectPartnerStatus(partnerId);
  return NextResponse.json({ partner: { ...partner, connect } });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { partnerId } = await context.params;
  const existing = await getCommissionPartner(partnerId);
  if (!existing) return NextResponse.json({ error: "Partner not found." }, { status: 404 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  const partner = await updateCommissionPartner(partnerId, parsed.data);
  const connect = await getConnectPartnerStatus(partnerId);
  const all = await listCommissionPartners();

  return NextResponse.json({
    ok: true,
    partner: { ...partner, connect },
    shareTotal: sumEnabledSharePercents(all),
    shareValid: sumEnabledSharePercents(all) === 100,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { partnerId } = await context.params;
  const removed = await deleteCommissionPartner(partnerId);
  if (!removed) return NextResponse.json({ error: "Partner not found." }, { status: 404 });

  const all = await listCommissionPartners();
  return NextResponse.json({
    ok: true,
    shareTotal: sumEnabledSharePercents(all),
    shareValid: sumEnabledSharePercents(all) === 100,
  });
}