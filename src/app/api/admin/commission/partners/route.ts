import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  createCommissionPartner,
  listCommissionPartners,
  validatePartnerShares,
} from "@/lib/commission-partners-store";
import { commissionSplitMode } from "@/lib/stripe-commission";
import { listConnectPartnerStatuses } from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  sharePercent: z.number().min(0).max(100).optional(),
  notes: z.string().max(500).nullable().optional(),
});

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [partners, statuses] = await Promise.all([
    listCommissionPartners(),
    listConnectPartnerStatuses(),
  ]);
  const statusById = new Map(statuses.map((s) => [s.partnerId, s]));

  const shareCheck = validatePartnerShares(partners, commissionSplitMode());
  return NextResponse.json({
    partners: partners.map((p) => ({
      ...p,
      connect: statusById.get(p.id) ?? null,
    })),
    shareTotal: shareCheck.shareTotal,
    shareValid: shareCheck.shareValid,
    shareMessage: shareCheck.message,
  });
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid partner data." }, { status: 400 });
  }

  const partner = await createCommissionPartner(parsed.data);
  const connect = await listConnectPartnerStatuses();
  const status = connect.find((s) => s.partnerId === partner.id) ?? null;

  return NextResponse.json({ ok: true, partner: { ...partner, connect: status } });
}