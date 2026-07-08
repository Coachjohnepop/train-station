import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import {
  getMemberEquipmentWithStatus,
  setMemberEquipment,
} from "@/lib/equipment-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const equipment = await getMemberEquipmentWithStatus(auth.session.id);
  return NextResponse.json({ equipment });
}

export async function POST(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { equipment: updates } = body;

  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const equipment = await setMemberEquipment(auth.session.id, updates);
  return NextResponse.json({ success: true, equipment });
}