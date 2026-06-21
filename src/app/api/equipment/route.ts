import { NextResponse } from "next/server";
import {
  isDemoMode,
  getAllEquipmentWithUserStatus,
  setDemoUserEquipment,
  normalizeEquipmentUpdates,
} from "@/lib/demo-equipment";
import { resolveUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET() {
  if (isDemoMode()) {
    const uid = await resolveUserId();
    const equipment = await getAllEquipmentWithUserStatus(uid);
    return NextResponse.json({ equipment });
  }

  return NextResponse.json({ equipment: [], error: "Not implemented for real DB yet" }, { status: 501 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { equipment: updates } = body;

  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (isDemoMode()) {
    const uid = await resolveUserId();
    const normalized = normalizeEquipmentUpdates(updates);
    if (normalized.length === 0) {
      return NextResponse.json({ error: "No equipment items in payload" }, { status: 400 });
    }

    await setDemoUserEquipment(normalized, uid);
    const equipment = await getAllEquipmentWithUserStatus(uid);
    return NextResponse.json({ success: true, equipment });
  }

  return NextResponse.json({ success: false, error: "Not implemented for real DB yet" }, { status: 501 });
}