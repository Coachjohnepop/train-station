import { NextResponse } from "next/server";
import { isDemoMode, getAllEquipmentWithUserStatus, setDemoUserEquipment, getDemoUserEquipment } from "@/lib/demo-equipment";
import { resolveUserId } from "@/lib/current-user";

export async function GET() {
  if (isDemoMode()) {
    const uid = await resolveUserId();
    const equipment = getAllEquipmentWithUserStatus(uid);
    return NextResponse.json({ equipment });
  }

  // TODO: real DB path with prisma + current user (from session/auth)
  return NextResponse.json({ equipment: [], error: "Not implemented for real DB yet" }, { status: 501 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { equipment: updates } = body; // expect { equipment: [{equipmentId, hasAtHome, quantity?, notes?}, ...] }

  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (isDemoMode()) {
    const uid = await resolveUserId();
    // persist per joined user
    const current = getDemoUserEquipment(uid);
    const map = new Map(current.map(u => [u.equipmentId, u]));

    updates.forEach((u: any) => {
      if (u.equipmentId) {
        map.set(u.equipmentId, {
          equipmentId: u.equipmentId,
          hasAtHome: !!u.hasAtHome,
          quantity: u.quantity ?? 1,
          notes: u.notes,
        });
      }
    });

    setDemoUserEquipment(Array.from(map.values()), uid);
    const equipment = getAllEquipmentWithUserStatus(uid);
    return NextResponse.json({ success: true, equipment });
  }

  // TODO: real DB
  return NextResponse.json({ success: false, error: "Not implemented for real DB yet" }, { status: 501 });
}
