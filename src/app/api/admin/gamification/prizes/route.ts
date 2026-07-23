import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-auth";
import { isDatabaseConfigured } from "@/lib/database-config";
import { awardPrize, listRecentPrizes } from "@/lib/gamification-prizes";

export const dynamic = "force-dynamic";

const awardSchema = z.object({
  userId: z.string().min(1),
  label: z.string().min(1).max(200),
  freeDays: z.number().int().min(0).max(90).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const prizes = await listRecentPrizes(30);
  return NextResponse.json({ prizes, database: isDatabaseConfigured() });
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ detail: "Database required." }, { status: 503 });
  }
  const body = awardSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ detail: body.error.flatten() }, { status: 400 });
  }
  try {
    const prize = await awardPrize({
      userId: body.data.userId,
      label: body.data.label,
      freeDays: body.data.freeDays,
      notes: body.data.notes,
      awardedBy: auth.session.id,
    });
    return NextResponse.json({ prize }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Award failed";
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}
