import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addChatMessage,
  COMMUNITY_FEED_PROGRAM_SLUG,
  ensureCohortThread,
  ensureMemberThread,
  COACH_READER_ID,
} from "@/lib/coach-chat";
import { requireCoachChatAccess } from "@/lib/chat-compose-auth";
import { createTodaySessionFromSms } from "@/lib/today-sessions";
import { sendCoachChatAlert, sendCoachReplySms } from "@/lib/sms";
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
  imageUrl: z.string().optional(),
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
    const auth = await requireCoachChatAccess();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 403 });
    }

    const json = await request.json();
    const input = schema.parse(json);

    const isCohort = input.audience === "cohort";
    const memberIds = isCohort
      ? input.memberIds ?? []
      : input.memberIds?.length
        ? input.memberIds
        : [DEFAULT_DEMO_MEMBER_ID];

    if (!isCohort && memberIds.length === 0) {
      return NextResponse.json({ error: "Select at least one member." }, { status: 400 });
    }

    const threads = isCohort
      ? [
          await ensureCohortThread(
            input.programSlug || COMMUNITY_FEED_PROGRAM_SLUG,
            input.programName || "Train Station community",
          ),
        ]
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

    const caption = input.body?.trim() || "";
    const hasVideo = !!input.mediaUrl;
    const hasImage = !!input.imageUrl;
    const hasYoutube = !!youtubeId;
    const hasWorkout = !!sessionResult;
    const hasRichMedia = hasVideo || hasImage || hasYoutube;
    const hasText = !!caption && !hasRichMedia;

    if (!caption && !hasVideo && !hasImage && !hasYoutube && !hasWorkout) {
      return NextResponse.json(
        { error: "Add a message, image, video, YouTube link, or SMS workout" },
        { status: 400 },
      );
    }

    const createdMessages: any[] = [];
    const authorName = coachDisplayName(auth.session);

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
            body: caption,
            alertSent: !!input.sendSmsAlert,
            readByUserIds: [COACH_READER_ID],
          }),
        );
      }

      if (hasImage && input.imageUrl) {
        createdMessages.push(
          await addChatMessage({
            threadId: thread.id,
            authorRole: "coach",
            authorId: COACH_READER_ID,
            authorName,
            kind: "image",
            body: caption || undefined,
            mediaUrl: input.imageUrl,
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
            body: caption || undefined,
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
            body: caption || undefined,
            mediaUrl: input.youtubeUrl,
            youtubeId,
            alertSent: !!input.sendSmsAlert,
            readByUserIds: [COACH_READER_ID],
          }),
        );
      }
    }

    let alertResult = { sent: 0, logs: [] as any[] };
    if (input.sendSmsAlert !== false && memberIds.length > 0) {
      if (hasText && !isCohort) {
        const smsLogs: any[] = [];
        for (const memberId of memberIds) {
          const result = await sendCoachReplySms({
            memberId,
            message: caption,
            coachName: authorName,
          });
          if (result.sent > 0) {
            smsLogs.push({ userId: memberId, phone: result.phone, sentAt: result.sentAt, simulated: result.simulated });
          }
        }
        alertResult = { sent: smsLogs.length, logs: smsLogs };
      } else if (!isCohort) {
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