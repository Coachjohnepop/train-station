import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { createMerchandiseSku, listAllMerchandiseSkus } from "@/lib/merchandise-store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  priceCents: z.number().int().min(0),
  stripePriceId: z.string().max(120).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const skus = await listAllMerchandiseSkus();
  return NextResponse.json({ skus });
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid merchandise SKU." }, { status: 400 });
  }

  const sku = await createMerchandiseSku(parsed.data);
  return NextResponse.json({ ok: true, sku });
}