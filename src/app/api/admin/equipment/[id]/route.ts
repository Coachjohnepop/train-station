import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  deleteEquipmentItem,
  equipmentCatalogStorage,
  updateEquipmentItem,
} from "@/lib/equipment-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.string().max(100).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  productUrl: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().max(2000).optional().nullable(),
});

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const equipment = await updateEquipmentItem(id, parsed.data);
    return NextResponse.json({
      ...equipment,
      storage: equipmentCatalogStorage(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update equipment";
    const status = message.includes("not found")
      ? 404
      : message.includes("already exists")
        ? 409
        : message.includes("valid") || message.includes("required")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    await deleteEquipmentItem(id);
    return NextResponse.json({
      success: true,
      storage: equipmentCatalogStorage(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete equipment";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}