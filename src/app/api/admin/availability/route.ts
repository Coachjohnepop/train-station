import { NextResponse } from "next/server";
import { z } from "zod";
import { getAvailabilities, setAvailabilities } from "@/lib/booking";
import { requireStaff } from "@/lib/api-auth";

function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}
let demoAvails: any[] = [];

const setSchema = z.array(z.object({
  weekday: z.number().int().min(0).max(6),
  startHour: z.number().int().min(0).max(23),
  startMinute: z.number().int().min(0).max(59),
  endHour: z.number().int().min(0).max(23),
  endMinute: z.number().int().min(0).max(59),
}));

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  if (isDemoMode()) return NextResponse.json(demoAvails);
  const avails = await getAvailabilities();
  return NextResponse.json(avails);
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const parsed = setSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }
  if (isDemoMode()) {
    demoAvails = parsed.data.map((s: any, i: number) => ({ id: "demo-av-" + i, ...s, slotDurationMin: 15, isActive: true }));
    return NextResponse.json({ ok: true });
  }
  await setAvailabilities(parsed.data);
  return NextResponse.json({ ok: true });
}
