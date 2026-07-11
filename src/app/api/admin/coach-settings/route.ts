import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { getCoachSettings, saveCoachSettings } from "@/lib/coach-settings-store";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  coachPhone: z.string().max(40).nullable().optional(),
  coachEmail: z.string().email().max(120).nullable().optional(),
  messagingEnabled: z.boolean().optional(),
  autoPromptIntroBooking: z.boolean().optional(),
  autoPromptFollowUpBooking: z.boolean().optional(),
  commissionPayoutMode: z.enum(["on_demand", "weekly"]).optional(),
  commissionPayoutWeekday: z.number().int().min(0).max(6).optional(),
  alertPrefs: z.record(z.string(), z.unknown()).optional(),
  warmupBlocks: z.array(z.unknown()).optional(),
  rampTemplate: z.array(z.unknown()).optional(),
  gamificationPoints: z.record(z.string(), z.number().int().min(0).max(10_000)).optional(),
  programStartMaxOffsetDays: z.number().int().min(0).max(14).optional(),
  programStartRecommendWeekday: z.number().int().min(0).max(6).nullable().optional(),
  programBlockDays: z.number().int().min(7).max(56).optional(),
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
    messagingEnabled: body.data.messagingEnabled,
    autoPromptIntroBooking: body.data.autoPromptIntroBooking,
    autoPromptFollowUpBooking: body.data.autoPromptFollowUpBooking,
    commissionPayoutMode: body.data.commissionPayoutMode,
    commissionPayoutWeekday: body.data.commissionPayoutWeekday,
    alertPrefs: body.data.alertPrefs as Parameters<typeof saveCoachSettings>[0]["alertPrefs"],
    warmupBlocks: body.data.warmupBlocks as Parameters<typeof saveCoachSettings>[0]["warmupBlocks"],
    rampTemplate: body.data.rampTemplate as Parameters<typeof saveCoachSettings>[0]["rampTemplate"],
    gamificationPoints: body.data.gamificationPoints as Parameters<
      typeof saveCoachSettings
    >[0]["gamificationPoints"],
    programStartMaxOffsetDays: body.data.programStartMaxOffsetDays,
    programStartRecommendWeekday: body.data.programStartRecommendWeekday,
    programBlockDays: body.data.programBlockDays,
  });
  return NextResponse.json({ settings });
}