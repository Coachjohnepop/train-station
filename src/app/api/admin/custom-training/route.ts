import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  createCustomTrainingOffer,
  listCustomTrainingOffers,
} from "@/lib/custom-training-offers-store";
import { appBaseUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const schema = z.object({
  label: z.string().min(1).max(120),
  memberEmail: z.string().email().optional().nullable(),
  memberUserId: z.string().max(120).optional().nullable(),
  priceCents: z.number().int().min(0),
  notes: z.string().max(500).optional().nullable(),
  parameters: z.object({
    daysPerWeek: z.number().int().min(1).max(7),
    minutesPerSession: z.number().int().min(15).max(180),
    sessionsPerDay: z.number().int().min(1).max(4),
    dropInDays: z.array(z.string()).default([]),
    notes: z.string().max(500).optional().nullable(),
  }),
});

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const offers = await listCustomTrainingOffers();
  const base = appBaseUrl();
  return NextResponse.json({
    offers: offers.map((o) => ({
      ...o,
      checkoutPath: `/member/checkout?plan=custom_training&offerId=${encodeURIComponent(o.id)}`,
      checkoutUrl: `${base}/member/checkout?plan=custom_training&offerId=${encodeURIComponent(o.id)}`,
    })),
  });
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid custom training offer." }, { status: 400 });
  }

  const offer = await createCustomTrainingOffer({
    label: parsed.data.label,
    memberEmail: parsed.data.memberEmail,
    memberUserId: parsed.data.memberUserId,
    priceCents: parsed.data.priceCents,
    notes: parsed.data.notes,
    createdByEmail: session.email,
    parameters: {
      ...parsed.data.parameters,
      notes: parsed.data.parameters.notes ?? null,
    },
  });
  const base = appBaseUrl();
  return NextResponse.json({
    ok: true,
    offer,
    checkoutUrl: `${base}/member/checkout?plan=custom_training&offerId=${encodeURIComponent(offer.id)}`,
  });
}