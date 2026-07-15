import { NextResponse } from "next/server";
import { z } from "zod";
import { createTodaySessionFromSms, hydrateTodaySessions } from "@/lib/today-sessions";
import { sendCoachChatAlert } from "@/lib/sms";
import { requireStaff } from "@/lib/api-auth";

const individualSchema = z.object({
  userId: z.string().min(1),
  rawSms: z.string().min(1),
  title: z.string().optional(),
});

const restTimerSchema = z.object({
  enabled: z.boolean(),
  seconds: z.number().int().min(15).max(600),
});

const schema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledAt: z.string().min(1),
  programSlug: z.string().optional(),
  replacesSchedule: z.boolean().optional(),
  /** Pull members off any other class that day (default true) — mid-live replace. */
  replaceExisting: z.boolean().optional(),
  sendSmsAlert: z.boolean().optional(),
  restTimer: restTimerSchema.optional(),
  cascade: z
    .object({
      rawSms: z.string().min(1),
      userIds: z.array(z.string()).min(1),
      title: z.string().optional(),
      workoutId: z.string().optional(),
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
    replaceExisting = true,
    sendSmsAlert = false,
    restTimer,
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
    await hydrateTodaySessions();

    if (cascade && cascade.userIds.length > 0) {
      const result = await createTodaySessionFromSms({
        sessionDate,
        scheduledAt,
        rawSms: cascade.rawSms,
        programSlug,
        userIds: cascade.userIds,
        replacesSchedule,
        replaceExisting,
        createdBy: "coach",
        title: cascade.title,
        workoutId: cascade.workoutId,
        restTimer,
      });
      sessions.push(result);
      allUserIds.push(...cascade.userIds);
    }

    if (individuals.length > 0) {
      const individualResults = await Promise.all(
        individuals.map((ind) =>
          createTodaySessionFromSms({
            sessionDate,
            scheduledAt,
            rawSms: ind.rawSms,
            programSlug,
            userIds: [ind.userId],
            replacesSchedule,
            replaceExisting,
            createdBy: "coach",
            title: ind.title,
            restTimer,
          }),
        ),
      );
      sessions.push(...individualResults);
      allUserIds.push(...individuals.map((ind) => ind.userId));
    }

    if (sendSmsAlert && allUserIds.length > 0) {
      void sendCoachChatAlert({ userIds: allUserIds, sessionDate }).catch((err) => {
        console.error("POST /api/today/cascade coach alert failed", err);
      });
    }

    const newExerciseIds = [
      ...new Set(sessions.flatMap((s) => s.newExerciseIds ?? [])),
    ];

    return NextResponse.json({
      sessions: sessions.map((s) => s.session),
      built: sessions.length,
      newExerciseIds,
      alerts: { sent: sendSmsAlert ? allUserIds.length : 0, logs: [] as unknown[] },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to assign workouts";
    console.error("POST /api/today/cascade failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}