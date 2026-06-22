import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addChatMessage,
  ensureCohortThread,
  ensureMemberThread,
  COACH_READER_ID,
} from "@/lib/coach-chat";
import { createTodaySessionFromSms } from "@/lib/today-sessions";
import { sendCoachChatAlert, sendCoachReplySms } from "@/lib/sms";
import { getSessionUser } from "@/lib/auth";
import { coachDisplayName, DEFAULT_DEMO_MEMBER_ID } from "@/lib/demo-coach";
import { youtubeVideoId } from "@/lib/youtube";

const schema = z.object({
  audience: z.enum(["member", "cohort", "members"]),
  memberIds: z.array(z.string()).optional(),
  programSlug: z.string().optional(),
  programName: z.string().optional(),
  body: z.string().optional(),
  rawSms: z.string().optional(),
  sessionDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  youtubeUrl: z.string().optional(),
  mediaUrl: z.string().optional(),
  videoDurationSec: z.number().optional(),
  sendSmsAlert: z.boolean().optional(),
});

function resolveScheduledIso(sessionDate: string, scheduledTime?: string) {
  const time = scheduledTime || "06:30";
  const d = new Date(`${sessionDate}T${time}:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid session date or time");
  return d.toISOString();
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = schema.parse(json);

    const memberIds =
      input.audience === "cohort"
        ? input.memberIds?.length
          ? input.memberIds
          : [DEFAULT_DEMO_MEMBER_ID]
        : input.memberIds?.length
          ? input.memberIds
          : [DEFAULT_DEMO_MEMBER_ID];

    const threads =
      input.audience === "cohort"
        ? [await ensureCohortThread(input.programSlug || "adult", input.programName)]
        : await Promise.all(memberIds.map((id) => ensureMemberThread(id)));

    let sessionResult: Awaited<ReturnType<typeof createTodaySessionFromSms>> | null = null;
    if (input.rawSms?.trim() && input.sessionDate) {
      sessionResult = await createTodaySessionFromSms({
        sessionDate: input.sessionDate,
        scheduledAt: resolveScheduledIso(input.sessionDate, input.scheduledTime),
        rawSms: input.rawSms.trim(),
        programSlug: input.programSlug || "adult",
        userIds: memberIds,
        replacesSchedule: true,
        createdBy: "coach",
      });
    }

    const youtubeId = input.youtubeUrl ? youtubeVideoId(input.youtubeUrl) : null;
    if (input.youtubeUrl && !youtubeId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    const hasText = !!input.body?.trim();
    const hasVideo = !!input.mediaUrl;
    const hasYoutube = !!youtubeId;
    const hasWorkout = !!sessionResult;

    if (!hasText && !hasVideo && !hasYoutube && !hasWorkout) {
      return NextResponse.json({ error: "Add a message, video, YouTube link, or SMS workout" }, { status: 400 });
    }

    const createdMessages: any[] = [];
    const coachSession = await getSessionUser();
    const authorName = coachDisplayName(coachSession);

    for (const thread of threads) {
      if (hasWorkout && sessionResult) {
        createdMessages.push(
          await addChatMessage({
            threadId: thread.id,
            authorRole: "coach",
            authorId: COACH_READER_ID,
            authorName,
            kind: "workout_update",
            body: sessionResult.session.title,
            sessionDate: sessionResult.session.sessionDate,
            todaySessionId: sessionResult.session.id,
            workoutId: sessionResult.workoutId,
            workoutTitle: sessionResult.session.title,
            alertSent: !!input.sendSmsAlert,
            readByUserIds: [COACH_READER_ID],
          }),
        );
      }

      if (hasText) {
        createdMessages.push(
          await addChatMessage({
            threadId: thread.id,
            authorRole: "coach",
            authorId: COACH_READER_ID,
            authorName,
            kind: "text",
            body: input.body!.trim(),
            alertSent: !!input.sendSmsAlert,
            readByUserIds: [COACH_READER_ID],
          }),
        );
      }

      if (hasVideo && input.mediaUrl) {
        createdMessages.push(
          await addChatMessage({
            threadId: thread.id,
            authorRole: "coach",
            authorId: COACH_READER_ID,
            authorName,
            kind: "video_upload",
            body: hasText ? "Coach video" : input.body?.trim() || "Coach video",
            mediaUrl: input.mediaUrl,
            videoDurationSec: input.videoDurationSec,
            alertSent: !!input.sendSmsAlert,
            readByUserIds: [COACH_READER_ID],
          }),
        );
      }

      if (hasYoutube && youtubeId) {
        createdMessages.push(
          await addChatMessage({
            threadId: thread.id,
            authorRole: "coach",
            authorId: COACH_READER_ID,
            authorName,
            kind: "youtube",
            body: hasText ? "Coach video" : input.body?.trim() || "Coach video",
            mediaUrl: input.youtubeUrl,
            youtubeId,
            alertSent: !!input.sendSmsAlert,
            readByUserIds: [COACH_READER_ID],
          }),
        );
      }
    }

    let alertResult = { sent: 0, logs: [] as any[] };
    if (input.sendSmsAlert !== false) {
      if (hasText && input.audience !== "cohort") {
        const smsLogs: any[] = [];
        for (const memberId of memberIds) {
          const result = await sendCoachReplySms({
            memberId,
            message: input.body!.trim(),
            coachName: authorName,
          });
          if (result.sent > 0) {
            smsLogs.push({ userId: memberId, phone: result.phone, sentAt: result.sentAt, simulated: result.simulated });
          }
        }
        alertResult = { sent: smsLogs.length, logs: smsLogs };
      } else {
        alertResult = await sendCoachChatAlert({
          userIds: memberIds,
          sessionDate: sessionResult?.session.sessionDate,
          coachName: authorName,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      threads: threads.map((t) => t.id),
      messages: createdMessages,
      session: sessionResult?.session ?? null,
      newExerciseIds: sessionResult?.newExerciseIds ?? [],
      alerts: alertResult,
    });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid request", detail: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: e?.message || "Compose failed" }, { status: 500 });
  }
}