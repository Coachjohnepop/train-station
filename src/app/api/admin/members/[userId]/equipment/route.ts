import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  getMemberEquipmentWithStatus,
  setMemberEquipment,
} from "@/lib/equipment-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

const saveSchema = z.object({
  equipment: z.array(
    z.object({
      id: z.string().optional(),
      equipmentId: z.string().optional(),
      hasAtHome: z.boolean(),
      quantity: z.number().int().min(1).max(99).optional(),
      notes: z.string().max(500).optional(),
    }),
  ),
});

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { userId } = await params;
  const equipment = await getMemberEquipmentWithStatus(userId);
  return NextResponse.json({ equipment });
}

export async function PUT(request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { userId } = await params;
  const parsed = saveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const equipment = await setMemberEquipment(userId, parsed.data.equipment);
  return NextResponse.json({ success: true, equipment });
}