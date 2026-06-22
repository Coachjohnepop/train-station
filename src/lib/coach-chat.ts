import path from "path";
import { randomUUID } from "crypto";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { BLOB_TOKEN, hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";

export type ChatThreadKind = "member" | "cohort";

export type ChatMessageKind =
  | "text"
  | "video_upload"
  | "youtube"
  | "workout_update"
  | "member_sms"
  | "system";

export type ChatThread = {
  id: string;
  kind: ChatThreadKind;
  memberId?: string;
  programSlug?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatReaction = {
  emoji: string;
  userId: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  authorRole: "coach" | "member" | "system";
  authorId: string;
  authorName: string;
  kind: ChatMessageKind;
  body?: string;
  mediaUrl?: string;
  youtubeId?: string;
  videoDurationSec?: number;
  sessionDate?: string;
  todaySessionId?: string;
  workoutId?: string;
  workoutTitle?: string;
  smsLogId?: string;
  alertSent?: boolean;
  createdAt: string;
  readByUserIds: string[];
  reactions?: ChatReaction[];
};

type ChatStore = {
  threads: ChatThread[];
  messages: ChatMessage[];
};

const DEV_FILE = path.join(process.cwd(), "prisma", "coach-chat.dev.json");
const BLOB_PATH = "demo/coach-chat.json";
const COACH_READER_ID = "coach";

let memoryStore: ChatStore | null = null;

function emptyStore(): ChatStore {
  return { threads: [], messages: [] };
}

function setMemory(store: ChatStore) {
  memoryStore = store;
}

export async function hydrateCoachChat(opts?: { preferFresh?: boolean }): Promise<ChatStore> {
  return hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory,
    fallback: emptyStore,
    preferFresh: opts?.preferFresh,
  });
}

export async function clearCoachChat(): Promise<{ threadsRemoved: number; messagesRemoved: number }> {
  await hydrateCoachChat();
  const store = readStore();
  const threadsRemoved = store.threads.length;
  const messagesRemoved = store.messages.length;
  const empty = emptyStore();
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: empty,
    setMemory,
  });
  return { threadsRemoved, messagesRemoved };
}

function readStore(): ChatStore {
  if (memoryStore) return memoryStore;
  memoryStore = readLocalJson<ChatStore>(DEV_FILE) || emptyStore();
  return memoryStore;
}

async function writeStore(store: ChatStore): Promise<{ blobSaved: boolean }> {
  return persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory,
  });
}

/** Memory-first — use before writes so we don't overwrite with a stale Blob snapshot. */
async function hydrateForWrite(): Promise<ChatStore> {
  return hydrateCoachChat();
}

function touchThread(store: ChatStore, threadId: string) {
  const t = store.threads.find((x) => x.id === threadId);
  if (t) t.updatedAt = new Date().toISOString();
}

export async function ensureMemberThread(memberId: string): Promise<ChatThread> {
  await hydrateForWrite();
  const store = readStore();
  const existing = store.threads.find((t) => t.kind === "member" && t.memberId === memberId);
  if (existing) return existing;

  const user = resolveDemoUser(memberId);
  const thread: ChatThread = {
    id: `thread-member-${memberId}`,
    kind: "member",
    memberId,
    title: user?.name || memberId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.threads.push(thread);
  await writeStore(store);
  return thread;
}

export async function ensureCohortThread(programSlug: string, programName?: string): Promise<ChatThread> {
  await hydrateForWrite();
  const store = readStore();
  const existing = store.threads.find((t) => t.kind === "cohort" && t.programSlug === programSlug);
  if (existing) return existing;

  const thread: ChatThread = {
    id: `thread-cohort-${programSlug}`,
    kind: "cohort",
    programSlug,
    title: programName || `${programSlug} cohort`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.threads.push(thread);
  await writeStore(store);
  return thread;
}

export function listThreadsForCoach(): ChatThread[] {
  return readStore().threads.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function listThreadsForMember(memberId: string, programSlugs: string[] = []): ChatThread[] {
  const store = readStore();
  const direct: ChatThread[] = [];
  const cohorts: ChatThread[] = [];
  const memberThread = store.threads.find((t) => t.kind === "member" && t.memberId === memberId);
  if (memberThread) direct.push(memberThread);
  for (const slug of programSlugs) {
    const cohort = store.threads.find((t) => t.kind === "cohort" && t.programSlug === slug);
    if (cohort) cohorts.push(cohort);
  }
  cohorts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return [...direct, ...cohorts];
}

export function getThread(threadId: string): ChatThread | null {
  return readStore().threads.find((t) => t.id === threadId) ?? null;
}

/** Hydrate from Blob, then find or create thread by canonical id (serverless-safe). */
export async function resolveThreadById(
  threadId: string,
  opts?: { preferFresh?: boolean },
): Promise<ChatThread | null> {
  await hydrateCoachChat({ preferFresh: opts?.preferFresh });
  const existing = getThread(threadId);
  if (existing) return existing;

  const memberMatch = threadId.match(/^thread-member-(.+)$/);
  if (memberMatch?.[1]) {
    return ensureMemberThread(memberMatch[1]);
  }

  const cohortMatch = threadId.match(/^thread-cohort-(.+)$/);
  if (cohortMatch?.[1]) {
    return ensureCohortThread(cohortMatch[1]);
  }

  return null;
}

export function getMessagesForThread(threadId: string, limit = 200): ChatMessage[] {
  return readStore()
    .messages.filter((m) => m.threadId === threadId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-limit);
}

export async function addChatMessage(input: Omit<ChatMessage, "id" | "createdAt" | "readByUserIds"> & {
  readByUserIds?: string[];
}): Promise<ChatMessage> {
  await hydrateForWrite();
  const store = readStore();
  const message: ChatMessage = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    readByUserIds: input.readByUserIds ?? (input.authorRole === "coach" ? [COACH_READER_ID] : []),
  };
  store.messages.push(message);
  touchThread(store, input.threadId);
  const { blobSaved } = await writeStore(store);
  if (process.env.VERCEL && BLOB_TOKEN && !blobSaved) {
    throw new Error("Chat message could not be saved to cloud storage — retry in a moment.");
  }
  return message;
}

export async function toggleMessageReaction(messageId: string, userId: string, emoji: string) {
  await hydrateForWrite();
  const store = readStore();
  const message = store.messages.find((m) => m.id === messageId);
  if (!message) return null;

  const reactions = message.reactions ?? [];
  const idx = reactions.findIndex((r) => r.userId === userId && r.emoji === emoji);
  if (idx >= 0) {
    reactions.splice(idx, 1);
  } else {
    reactions.push({ emoji, userId, createdAt: new Date().toISOString() });
  }
  message.reactions = reactions;
  await writeStore(store);
  return message;
}

export async function markThreadRead(threadId: string, readerId: string) {
  await hydrateForWrite();
  const store = readStore();
  let changed = false;
  for (const m of store.messages) {
    if (m.threadId !== threadId) continue;
    if (!m.readByUserIds.includes(readerId)) {
      m.readByUserIds.push(readerId);
      changed = true;
    }
  }
  if (changed) await writeStore(store);
}

export function getUnreadCountForMember(memberId: string, programSlugs: string[] = []): number {
  const threads = listThreadsForMember(memberId, programSlugs);
  const threadIds = new Set(threads.map((t) => t.id));
  return readStore().messages.filter(
    (m) =>
      threadIds.has(m.threadId) &&
      m.authorRole === "coach" &&
      !m.readByUserIds.includes(memberId),
  ).length;
}

export function getUnreadCountForCoach(): number {
  return Object.values(getUnreadCountsByThreadForCoach()).reduce((n, c) => n + c, 0);
}

/** Per-thread unread member messages (for inbox badges). */
export function getUnreadCountsByThreadForCoach(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of readStore().messages) {
    if (m.authorRole !== "member") continue;
    if (m.readByUserIds.includes(COACH_READER_ID)) continue;
    counts[m.threadId] = (counts[m.threadId] || 0) + 1;
  }
  return counts;
}

export async function appendMemberSmsToChat(params: {
  memberId: string;
  body: string;
  phone: string;
  smsLogId?: string;
}) {
  const thread = await ensureMemberThread(params.memberId);
  const user = resolveDemoUser(params.memberId);
  return addChatMessage({
    threadId: thread.id,
    authorRole: "member",
    authorId: params.memberId,
    authorName: user?.name || "Member",
    kind: "member_sms",
    body: params.body,
    smsLogId: params.smsLogId,
  });
}

export { COACH_READER_ID };