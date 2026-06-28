import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { getCoachSettings, saveCoachSettings } from "@/lib/coach-settings-store";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  coachPhone: z.string().max(40).nullable().optional(),
  coachEmail: z.string().email().max(120).nullable().optional(),
  alertPrefs: z.record(z.string(), z.unknown()).optional(),
  warmupBlocks: z.array(z.unknown()).optional(),
  rampTemplate: z.array(z.unknown()).optional(),
});

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getCoachSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ detail: body.error.flatten() }, { status: 400 });
  }

  const settings = await saveCoachSettings({
    coachPhone: body.data.coachPhone,
    coachEmail: body.data.coachEmail,
    alertPrefs: body.data.alertPrefs as Parameters<typeof saveCoachSettings>[0]["alertPrefs"],
    warmupBlocks: body.data.warmupBlocks as Parameters<typeof saveCoachSettings>[0]["warmupBlocks"],
    rampTemplate: body.data.rampTemplate as Parameters<typeof saveCoachSettings>[0]["rampTemplate"],
  });
  return NextResponse.json({ settings });
}