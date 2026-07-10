import "server-only";

import type {
  ChatMessage,
  ChatReaction,
  ChatStore,
  ChatThread,
} from "@/lib/coach-chat-types";
import { prisma } from "@/lib/prisma";

function toIso(value: Date): string {
  return value.toISOString();
}

function parseReactions(raw: unknown): ChatReaction[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const reactions: ChatReaction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const data = item as Partial<ChatReaction>;
    if (!data.emoji || !data.userId || !data.createdAt) continue;
    reactions.push({
      emoji: data.emoji,
      userId: data.userId,
      createdAt: data.createdAt,
    });
  }
  return reactions.length > 0 ? reactions : undefined;
}

function rowToThread(row: {
  id: string;
  kind: string;
  memberId: string | null;
  programSlug: string | null;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}): ChatThread {
  return {
    id: row.id,
    kind: row.kind as ChatThread["kind"],
    memberId: row.memberId ?? undefined,
    programSlug: row.programSlug ?? undefined,
    title: row.title,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function rowToMessage(row: {
  id: string;
  threadId: string;
  authorRole: string;
  authorId: string;
  authorName: string;
  kind: string;
  body: string | null;
  mediaUrl: string | null;
  youtubeId: string | null;
  videoDurationSec: number | null;
  sessionDate: string | null;
  todaySessionId: string | null;
  workoutId: string | null;
  workoutTitle: string | null;
  smsLogId: string | null;
  alertSent: boolean;
  readByUserIds: string[];
  reactions: unknown;
  createdAt: Date;
}): ChatMessage {
  return {
    id: row.id,
    threadId: row.threadId,
    authorRole: row.authorRole as ChatMessage["authorRole"],
    authorId: row.authorId,
    authorName: row.authorName,
    kind: row.kind as ChatMessage["kind"],
    body: row.body ?? undefined,
    mediaUrl: row.mediaUrl ?? undefined,
    youtubeId: row.youtubeId ?? undefined,
    videoDurationSec: row.videoDurationSec ?? undefined,
    sessionDate: row.sessionDate ?? undefined,
    todaySessionId: row.todaySessionId ?? undefined,
    workoutId: row.workoutId ?? undefined,
    workoutTitle: row.workoutTitle ?? undefined,
    smsLogId: row.smsLogId ?? undefined,
    alertSent: row.alertSent,
    createdAt: toIso(row.createdAt),
    readByUserIds: row.readByUserIds,
    reactions: parseReactions(row.reactions),
  };
}

function threadToRow(thread: ChatThread) {
  return {
    id: thread.id,
    kind: thread.kind,
    memberId: thread.memberId ?? null,
    programSlug: thread.programSlug ?? null,
    title: thread.title,
    createdAt: new Date(thread.createdAt),
    updatedAt: new Date(thread.updatedAt),
  };
}

function messageToRow(message: ChatMessage) {
  return {
    id: message.id,
    threadId: message.threadId,
    authorRole: message.authorRole,
    authorId: message.authorId,
    authorName: message.authorName,
    kind: message.kind,
    body: message.body ?? null,
    mediaUrl: message.mediaUrl ?? null,
    youtubeId: message.youtubeId ?? null,
    videoDurationSec: message.videoDurationSec ?? null,
    sessionDate: message.sessionDate ?? null,
    todaySessionId: message.todaySessionId ?? null,
    workoutId: message.workoutId ?? null,
    workoutTitle: message.workoutTitle ?? null,
    smsLogId: message.smsLogId ?? null,
    alertSent: Boolean(message.alertSent),
    readByUserIds: message.readByUserIds,
    reactions: message.reactions ?? undefined,
    createdAt: new Date(message.createdAt),
  };
}

export async function loadCoachChatFromDb(): Promise<ChatStore> {
  const [threads, messages] = await Promise.all([
    prisma.coachChatThread.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.coachChatMessage.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return {
    threads: threads.map(rowToThread),
    messages: messages.map(rowToMessage),
  };
}

export async function upsertCoachChatThreadToDb(thread: ChatThread): Promise<void> {
  const data = threadToRow(thread);
  await prisma.coachChatThread.upsert({
    where: { id: thread.id },
    create: data,
    update: {
      kind: data.kind,
      memberId: data.memberId,
      programSlug: data.programSlug,
      title: data.title,
      updatedAt: data.updatedAt,
    },
  });
}

export async function addCoachChatMessageToDb(message: ChatMessage): Promise<void> {
  const data = messageToRow(message);
  await prisma.$transaction(async (tx) => {
    await tx.coachChatMessage.create({ data });
    await tx.coachChatThread.update({
      where: { id: message.threadId },
      data: { updatedAt: new Date() },
    });
  });
}

export async function coachChatMessageExistsInDb(messageId: string): Promise<boolean> {
  const row = await prisma.coachChatMessage.findUnique({
    where: { id: messageId },
    select: { id: true },
  });
  return Boolean(row);
}

export async function updateCoachChatMessageInDb(message: ChatMessage): Promise<void> {
  const data = messageToRow(message);
  await prisma.coachChatMessage.update({
    where: { id: message.id },
    data: {
      body: data.body,
      mediaUrl: data.mediaUrl,
      youtubeId: data.youtubeId,
      videoDurationSec: data.videoDurationSec,
      sessionDate: data.sessionDate,
      todaySessionId: data.todaySessionId,
      workoutId: data.workoutId,
      workoutTitle: data.workoutTitle,
      smsLogId: data.smsLogId,
      alertSent: data.alertSent,
      readByUserIds: data.readByUserIds,
      reactions: data.reactions,
    },
  });
}

export async function markThreadReadInDb(
  threadId: string,
  readerId: string,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const messages = await tx.coachChatMessage.findMany({
      where: {
        threadId,
        NOT: { readByUserIds: { has: readerId } },
      },
    });
    if (messages.length === 0) return false;

    for (const message of messages) {
      await tx.coachChatMessage.update({
        where: { id: message.id },
        data: { readByUserIds: [...message.readByUserIds, readerId] },
      });
    }
    return true;
  });
}

export async function clearCoachChatInDb(): Promise<{
  threadsRemoved: number;
  messagesRemoved: number;
}> {
  const messagesRemoved = await prisma.coachChatMessage.deleteMany({});
  const threadsRemoved = await prisma.coachChatThread.deleteMany({});
  return {
    threadsRemoved: threadsRemoved.count,
    messagesRemoved: messagesRemoved.count,
  };
}

export async function probeCoachChatDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.coachChatThread.count();
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Coach chat DB probe failed";
    return { ok: false, message };
  }
}