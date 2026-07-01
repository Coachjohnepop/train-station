import { NextResponse } from "next/server";
import { z } from "zod";
import { createTodaySessionFromSms } from "@/lib/today-sessions";
import { sendCoachChatAlert } from "@/lib/sms";
import { requireStaff } from "@/lib/api-auth";

const individualSchema = z.object({
  userId: z.string().min(1),
  rawSms: z.string().min(1),
  title: z.string().optional(),
});

const schema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledAt: z.string().min(1),
  programSlug: z.string().optional(),
  replacesSchedule: z.boolean().optional(),
  sendSmsAlert: z.boolean().optional(),
  cascade: z
    .object({
      rawSms: z.string().min(1),
      userIds: z.array(z.string()).min(1),
      title: z.string().optional(),
    })
    .optional(),
  individuals: z.array(individualSchema).optional(),
});

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const {
    sessionDate,
    scheduledAt,
    programSlug = "adult",
    replacesSchedule = true,
    sendSmsAlert = false,
    cascade,
    individuals = [],
  } = parsed.data;

  if (!cascade?.userIds?.length && individuals.length === 0) {
    return NextResponse.json(
      { error: "Assign at least one student (cascade group or individual)." },
      { status: 400 },
    );
  }

  const sessions: Awaited<ReturnType<typeof createTodaySessionFromSms>>[] = [];
  const allUserIds: string[] = [];

  try {
    if (cascade && cascade.userIds.length > 0) {
      const result = await createTodaySessionFromSms({
        sessionDate,
        scheduledAt,
        rawSms: cascade.rawSms,
        programSlug,
        userIds: cascade.userIds,
        replacesSchedule,
        createdBy: "coach",
        title: cascade.title,
      });
      sessions.push(result);
      allUserIds.push(...cascade.userIds);
    }

    for (const ind of individuals) {
      const result = await createTodaySessionFromSms({
        sessionDate,
        scheduledAt,
        rawSms: ind.rawSms,
        programSlug,
        userIds: [ind.userId],
        replacesSchedule,
        createdBy: "coach",
        title: ind.title,
      });
      sessions.push(result);
      allUserIds.push(ind.userId);
    }

    let alerts = { sent: 0, logs: [] as unknown[] };
    if (sendSmsAlert && allUserIds.length > 0) {
      alerts = await sendCoachChatAlert({ userIds: allUserIds, sessionDate });
    }

    return NextResponse.json({
      sessions: sessions.map((s) => s.session),
      built: sessions.length,
      alerts,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to assign workouts";
    console.error("POST /api/today/cascade failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}