import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { resolveUserId } from "@/lib/current-user";
import {
  getMemberEquipmentWithStatus,
  setMemberEquipment,
} from "@/lib/equipment-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const uid = await resolveUserId();
  const equipment = await getMemberEquipmentWithStatus(uid);
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

  const uid = await resolveUserId();
  const equipment = await setMemberEquipment(uid, updates);
  return NextResponse.json({ success: true, equipment });
}