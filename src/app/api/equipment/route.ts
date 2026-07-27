import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import {
  createEquipmentItem,
  getMemberEquipmentWithStatus,
  setMemberEquipment,
  type EquipmentWithUserStatus,
} from "@/lib/equipment-store";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { notifyCoachEquipmentSelected } from "@/lib/coach-member-notify";

export const dynamic = "force-dynamic";

async function maybeNotifyEquipment(
  session: { id: string; name?: string | null; email: string },
  equipment: EquipmentWithUserStatus[],
) {
  const selected = equipment.filter((e) => e.hasAtHome);
  if (!selected.length) return;
  try {
    const profile = await getMemberProfile(session.id);
    await notifyCoachEquipmentSelected({
      userId: session.id,
      name: session.name || "Member",
      email: session.email,
      plan: profile?.plan || null,
      equipmentNames: selected.map((e) => e.name),
    });
  } catch (e) {
    console.warn("[equipment] coach notify failed", e);
  }
}

export async function GET() {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const equipment = await getMemberEquipmentWithStatus(auth.session.id);
  return NextResponse.json({ equipment });
}

export async function POST(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));

  // Add a custom home item not in the catalog (home-only — no shop link required).
  if (typeof body.name === "string" && body.name.trim()) {
    try {
      const created = await createEquipmentItem({
        name: body.name.trim(),
        category: typeof body.category === "string" ? body.category.trim() || "custom" : "custom",
        description:
          typeof body.description === "string" ? body.description.trim() || null : null,
        productUrl: null,
        imageUrl: null,
      });
      // Auto-check as "have at home"
      const equipment = await setMemberEquipment(auth.session.id, [
        {
          equipmentId: created.id,
          hasAtHome: true,
          quantity: 1,
          notes: body.notes?.trim?.() || null,
        },
      ]);
      void maybeNotifyEquipment(auth.session, equipment);
      return NextResponse.json({ success: true, created, equipment });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not add equipment.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const { equipment: updates } = body;

  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const equipment = await setMemberEquipment(auth.session.id, updates);
  void maybeNotifyEquipment(auth.session, equipment);
  return NextResponse.json({ success: true, equipment });
}