import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { listEquipmentShopItems } from "@/lib/equipment-store";

export const dynamic = "force-dynamic";

/** Member gear shop — equipment items that have a product link. */
export async function GET() {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const equipment = await listEquipmentShopItems();
  return NextResponse.json({ equipment });
}
