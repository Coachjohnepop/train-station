import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  createEquipmentItem,
  equipmentCatalogStorage,
  listEquipmentCatalog,
} from "@/lib/equipment-store";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(100).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  productUrl: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().max(2000).optional().nullable(),
});

export async function GET() {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const equipment = await listEquipmentCatalog();
  return NextResponse.json({
    equipment,
    storage: equipmentCatalogStorage(),
  });
}

export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const equipment = await createEquipmentItem(parsed.data);
    return NextResponse.json(
      { ...equipment, storage: equipmentCatalogStorage() },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create equipment";
    const status = message.includes("already exists")
      ? 409
      : message.includes("valid") ||
          message.includes("required") ||
          message.includes("Cannot publish") ||
          message.includes("working product photo")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}