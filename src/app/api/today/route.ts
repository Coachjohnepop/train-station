import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createTodaySessionFromSms,
  getTodaySessionForUser,
  listTodaySessions,
} from "@/lib/today-sessions";
import { parseSmsWorkout } from "@/lib/sms-workout-parser";
import { resolveUserId } from "@/lib/current-user";

const postSchema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledAt: z.string().min(1),
  rawSms: z.string().min(1),
  programSlug: z.string().optional(),
  userIds: z.array(z.string()).optional(),
  replacesSchedule: z.boolean().optional(),
  createdBy: z.string().optional(),
  title: z.string().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || (await resolveUserId("demo-user"));
  const date = searchParams.get("date");

  if (searchParams.get("all") === "1") {
    return NextResponse.json({ sessions: listTodaySessions() });
  }

  const session = date
    ? listTodaySessions().find((s) => s.sessionDate === date && (s.userIds.length === 0 || s.userIds.includes(userId)))
    : getTodaySessionForUser(userId);

  return NextResponse.json({ session, userId });
}

export async function POST(request: Request) {
  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const result = createTodaySessionFromSms(parsed.data);
  return NextResponse.json(result);
}