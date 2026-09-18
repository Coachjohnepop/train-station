import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformStaff } from "@/lib/api-auth";
import { saveMoneyDeskSettings } from "@/lib/money-desk-settings";
import { getMoneyMap } from "@/lib/stripe-money-map";

export const dynamic = "force-dynamic";

const schema = z.object({
  grokCents: z.number().int().min(0).max(50_000).optional(),
  vercelCents: z.number().int().min(0).max(50_000).optional(),
  supabaseCents: z.number().int().min(0).max(50_000).optional(),
  refundBufferCents: z.number().int().min(0).max(20_000).optional(),
  platformFeesPercent: z.number().int().min(0).max(100).optional(),
  johnPayPercent: z.number().int().min(0).max(100).optional(),
  reinvestPercent: z.number().int().min(0).max(100).optional(),
  jeremyPayPercent: z.number().int().min(0).max(100).optional(),
});

export async function GET() {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  try {
    const moneyMap = await getMoneyMap();
    return NextResponse.json(moneyMap, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load money desk.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings.", detail: parsed.error.flatten() }, { status: 400 });
  }
  try {
    await saveMoneyDeskSettings(parsed.data, auth.session.email || auth.session.id);
    const moneyMap = await getMoneyMap();
    return NextResponse.json({ ok: true, moneyMap }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not save money desk.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
