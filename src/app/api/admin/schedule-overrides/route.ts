import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearScheduleOverride,
  getAllScheduleOverrides,
  saveScheduleOverride,
} from "@/lib/demo-schedule-overrides";
import { sendSmsBroadcast } from "@/lib/sms";

const saveSchema = z.object({
  dayId: z.string().min(1),
  programSlug: z.string().optional(),
  weekNumber: z.number().int().positive().optional(),
  dayNumber: z.number().int().positive().optional(),
  smsWorkoutText: z.string().min(1),
  active: z.boolean().default(true),
  replacesLiveSession: z.boolean().default(false),
  label: z.string().optional(),
  sendSms: z.boolean().optional(),
  userIds: z.array(z.string()).optional(),
});

export async function GET() {
  return NextResponse.json({ overrides: getAllScheduleOverrides() });
}

export async function POST(request: Request) {
  const parsed = saveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const { sendSms, userIds, ...overrideInput } = parsed.data;
  const saved = saveScheduleOverride(overrideInput);

  let smsResult: { sent: number } | null = null;
  if (sendSms) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
    const link = `${appUrl}/member/workout?program=${encodeURIComponent(saved.programSlug || "adult")}&smsDay=${saved.dayId}`;
    const message = [
      saved.label ? `${saved.label}:` : "Today's workout:",
      saved.smsWorkoutText,
      `Open in app: ${link}`,
    ].join("\n\n");
    smsResult = await sendSmsBroadcast({
      userIds,
      message,
      category: "general",
      taskDetails: {
        type: "sms-workout-override",
        dayId: saved.dayId,
        programSlug: saved.programSlug,
        replacesLiveSession: saved.replacesLiveSession,
      },
    });
  }

  return NextResponse.json({ override: saved, sms: smsResult });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const dayId = searchParams.get("dayId");
  if (!dayId) {
    return NextResponse.json({ detail: "dayId required" }, { status: 400 });
  }
  const cleared = clearScheduleOverride(dayId);
  if (!cleared) {
    return NextResponse.json({ detail: "Override not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}