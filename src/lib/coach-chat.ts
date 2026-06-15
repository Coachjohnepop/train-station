import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { resolveDemoUser } from "@/lib/demo-user-directory";

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
};

type ChatStore = {
  threads: ChatThread[];
  messages: ChatMessage[];
};

const DEV_FILE = path.join(process.cwd(), "prisma", "coach-chat.dev.json");
const COACH_READER_ID = "coach";

let memoryStore: ChatStore | null = null;

function emptyStore(): ChatStore {
  return { threads: [], messages: [] };
}

function readStore(): ChatStore {
  if (memoryStore) return memoryStore;
  try {
    if (fs.existsSync(DEV_FILE)) {
      memoryStore = JSON.parse(fs.readFileSync(DEV_FILE, "utf8")) as ChatStore;
      return memoryStore;
    }
  } catch (e) {
    console.warn("Could not read coach-chat.dev.json", e);
  }
  memoryStore = emptyStore();
  return memoryStore;
}

function writeStore(store: ChatStore) {
  memoryStore = store;
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.warn("Could not persist coach-chat.dev.json (using in-memory)", e);
  }
}

function touchThread(store: ChatStore, threadId: string) {
  const t = store.threads.find((x) => x.id === threadId);
  if (t) t.updatedAt = new Date().toISOString();
}

export function ensureMemberThread(memberId: string): ChatThread {
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
  writeStore(store);
  return thread;
}

export function ensureCohortThread(programSlug: string, programName?: string): ChatThread {
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
  writeStore(store);
  return thread;
}

export function listThreadsForCoach(): ChatThread[] {
  return readStore().threads.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function listThreadsForMember(memberId: string, programSlugs: string[] = []): ChatThread[] {
  const store = readStore();
  const threads: ChatThread[] = [];
  const memberThread = store.threads.find((t) => t.kind === "member" && t.memberId === memberId);
  if (memberThread) threads.push(memberThread);
  for (const slug of programSlugs) {
    const cohort = store.threads.find((t) => t.kind === "cohort" && t.programSlug === slug);
    if (cohort) threads.push(cohort);
  }
  return threads.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getThread(threadId: string): ChatThread | null {
  return readStore().threads.find((t) => t.id === threadId) ?? null;
}

export function getMessagesForThread(threadId: string, limit = 200): ChatMessage[] {
  return readStore()
    .messages.filter((m) => m.threadId === threadId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-limit);
}

export function addChatMessage(input: Omit<ChatMessage, "id" | "createdAt" | "readByUserIds"> & {
  readByUserIds?: string[];
}): ChatMessage {
  const store = readStore();
  const message: ChatMessage = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    readByUserIds: input.readByUserIds ?? (input.authorRole === "coach" ? [COACH_READER_ID] : []),
  };
  store.messages.push(message);
  touchThread(store, input.threadId);
  writeStore(store);
  return message;
}

export function markThreadRead(threadId: string, readerId: string) {
  const store = readStore();
  let changed = false;
  for (const m of store.messages) {
    if (m.threadId !== threadId) continue;
    if (!m.readByUserIds.includes(readerId)) {
      m.readByUserIds.push(readerId);
      changed = true;
    }
  }
  if (changed) writeStore(store);
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
  const memberThreadIds = readStore()
    .threads.filter((t) => t.kind === "member")
    .map((t) => t.id);
  return readStore().messages.filter(
    (m) =>
      memberThreadIds.includes(m.threadId) &&
      m.authorRole === "member" &&
      !m.readByUserIds.includes(COACH_READER_ID),
  ).length;
}

export function appendMemberSmsToChat(params: {
  memberId: string;
  body: string;
  phone: string;
  smsLogId?: string;
}) {
  const thread = ensureMemberThread(params.memberId);
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