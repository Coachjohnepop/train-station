import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  createReferralCode,
  listReferralCodes,
  updateReferralCode,
  deleteReferralCode,
} from "@/lib/referral-codes-store";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  code: z.string().min(2).max(40),
  label: z.string().max(80).optional(),
  stripePromotionCodeId: z.string().max(120).nullable().optional(),
  stripeCouponId: z.string().max(120).nullable().optional(),
  ownerUserId: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const patchSchema = createSchema
  .partial()
  .extend({ id: z.string().min(1), enabled: z.boolean().optional() });

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const codes = await listReferralCodes();
  return NextResponse.json({ codes });
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid referral code data." }, { status: 400 });
  }

  try {
    const code = await createReferralCode(parsed.data);
    return NextResponse.json({ ok: true, code });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not create referral code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid referral code data." }, { status: 400 });
  }

  const { id, ...patch } = parsed.data;
  try {
    const code = await updateReferralCode(id, patch);
    return NextResponse.json({ ok: true, code });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not update referral code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Missing referral code id." }, { status: 400 });

  const removed = await deleteReferralCode(id);
  if (!removed) return NextResponse.json({ error: "Referral code not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}