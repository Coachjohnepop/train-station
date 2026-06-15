import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createTodaySessionFromSms,
  getTodaySessionForUser,
  hydrateTodaySessions,
  listTodaySessions,
} from "@/lib/today-sessions";
import { parseSmsWorkout } from "@/lib/sms-workout-parser";
import { resolveUserId } from "@/lib/current-user";
import { sendCoachChatAlert } from "@/lib/sms";

const postSchema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledAt: z.string().min(1),
  rawSms: z.string().min(1),
  programSlug: z.string().optional(),
  userIds: z.array(z.string()).min(1, "Select at least one member"),
  replacesSchedule: z.boolean().optional(),
  createdBy: z.string().optional(),
  title: z.string().optional(),
  sendSmsAlert: z.boolean().optional(),
});

export async function GET(request: Request) {
  await hydrateTodaySessions();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || (await resolveUserId("demo-user"));
  const date = searchParams.get("date");

  if (searchParams.get("all") === "1") {
    return NextResponse.json({ sessions: listTodaySessions() });
  }

  const session = date
    ? listTodaySessions().find((s) => s.sessionDate === date && s.userIds.includes(userId))
    : getTodaySessionForUser(userId);

  return NextResponse.json({ session, userId });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
    }

    const { sendSmsAlert, ...sessionInput } = parsed.data;
    const result = await createTodaySessionFromSms(sessionInput);

    let alerts = { sent: 0, logs: [] as any[] };
    if (sendSmsAlert && sessionInput.userIds.length > 0) {
      alerts = await sendCoachChatAlert({
        userIds: sessionInput.userIds,
        sessionDate: sessionInput.sessionDate,
      });
    }

    return NextResponse.json({ ...result, alerts });
  } catch (e: any) {
    console.error("POST /api/today failed", e);
    return NextResponse.json(
      { error: e?.message || "Failed to build workout from SMS" },
      { status: 500 },
    );
  }
}