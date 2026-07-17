import path from "path";
import { randomUUID } from "crypto";
import { COMMUNITY_FEED_PROGRAM_SLUG } from "@/lib/community-feed";
import { getUserEnrollments } from "@/lib/data/user-data";
import { getAccountByUserId } from "@/lib/member-accounts-store";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { isDemoMode } from "@/lib/demo-enrollments";
import { BLOB_TOKEN, hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import {
  addCoachChatMessageToDb,
  clearCoachChatInDb,
  coachChatMessageExistsInDb,
  loadCoachChatFromDb,
  markThreadReadInDb,
  updateCoachChatMessageInDb,
  upsertCoachChatThreadToDb,
} from "@/lib/coach-chat-db";
import {
  emptyCoachChatStore,
  type ChatMessage,
  type ChatMessageKind,
  type ChatReaction,
  type ChatStore,
  type ChatThread,
  type ChatThreadKind,
} from "@/lib/coach-chat-types";

export type {
  ChatMessage,
  ChatMessageKind,
  ChatReaction,
  ChatThread,
  ChatThreadKind,
};

export { COMMUNITY_FEED_PROGRAM_SLUG } from "@/lib/community-feed";

const DEV_FILE = path.join(process.cwd(), "prisma", "coach-chat.dev.json");
const BLOB_PATH = "demo/coach-chat.json";
const COACH_READER_ID = "coach";

let memoryStore: ChatStore | null = null;

function emptyStore(): ChatStore {
  return emptyCoachChatStore();
}

function setMemory(store: ChatStore) {
  memoryStore = store;
}

/** Union blob + instance state so serverless writes never clobber other instances. */
function mergeChatStores(base: ChatStore, overlay: ChatStore): ChatStore {
  const threadsById = new Map<string, ChatThread>();
  for (const t of base.threads) threadsById.set(t.id, t);
  for (const t of overlay.threads) {
    const existing = threadsById.get(t.id);
    if (!existing || new Date(t.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      threadsById.set(t.id, t);
    }
  }

  const messagesById = new Map<string, ChatMessage>();
  for (const m of base.messages) messagesById.set(m.id, m);
  for (const m of overlay.messages) messagesById.set(m.id, m);

  return {
    threads: [...threadsById.values()],
    messages: [...messagesById.values()],
  };
}

export async function hydrateCoachChat(opts?: { preferFresh?: boolean }): Promise<ChatStore> {
  if (!isDemoMode()) {
    const store = await loadCoachChatFromDb();
    setMemory(store);
    return store;
  }

  const local = memoryStore;
  const fresh = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory,
    fallback: emptyStore,
    preferFresh: opts?.preferFresh,
  });
  if (opts?.preferFresh && local && BLOB_TOKEN) {
    const merged = mergeChatStores(fresh, local);
    setMemory(merged);
    return merged;
  }
  return fresh;
}

export async function clearCoachChat(): Promise<{ threadsRemoved: number; messagesRemoved: number }> {
  if (!isDemoMode()) {
    const counts = await clearCoachChatInDb();
    setMemory(emptyStore());
    return counts;
  }

  await hydrateCoachChat();
  const store = readStore();
  const threadsRemoved = store.threads.length;
  const messagesRemoved = store.messages.length;
  const empty = emptyStore();
  const { blobSaved } = await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: empty,
    setMemory,
  });
  requireBlobPersisted(blobSaved, "Chat reset");
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

/**
 * Load latest state before write.
 * Demo: merge Blob + warm-instance memory.
 * Prod: reload from Postgres (transactional per-message writes).
 */
async function hydrateForWrite(): Promise<ChatStore> {
  if (!isDemoMode()) {
    const store = await loadCoachChatFromDb();
    setMemory(store);
    return store;
  }

  const local = memoryStore;
  const fresh = await hydrateCoachChat({ preferFresh: Boolean(BLOB_TOKEN) });
  if (!local || !BLOB_TOKEN) return fresh;
  const merged = mergeChatStores(fresh, local);
  setMemory(merged);
  return merged;
}

async function persistStore(store: ChatStore, action: string): Promise<void> {
  if (!isDemoMode()) {
    setMemory(store);
    return;
  }

  const { blobSaved } = await writeStore(store);
  requireBlobPersisted(blobSaved, action);
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
  const registered = user ? null : await getAccountByUserId(memberId);
  const displayName =
    user?.name || registered?.account.name || registered?.email || memberId;
  const thread: ChatThread = {
    id: `thread-member-${memberId}`,
    kind: "member",
    memberId,
    title: displayName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!isDemoMode()) {
    await upsertCoachChatThreadToDb(thread);
    store.threads.push(thread);
    setMemory(store);
    return thread;
  }

  store.threads.push(thread);
  await persistStore(store, "Chat thread");
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

  if (!isDemoMode()) {
    await upsertCoachChatThreadToDb(thread);
    store.threads.push(thread);
    setMemory(store);
    return thread;
  }

  store.threads.push(thread);
  await persistStore(store, "Chat thread");
  return thread;
}

export function listThreadsForCoach(): ChatThread[] {
  return readStore().threads.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function memberCanPostToThread(memberId: string, thread: ChatThread): Promise<boolean> {
  if (thread.kind === "member") {
    return thread.memberId === memberId;
  }
  if (thread.kind === "cohort") {
    const slug = thread.programSlug || COMMUNITY_FEED_PROGRAM_SLUG;
    const enrolled = Object.keys(await getUserEnrollments(memberId));
    return slug === COMMUNITY_FEED_PROGRAM_SLUG || enrolled.includes(slug);
  }
  return false;
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

/** Hydrate from store, then find or create thread by canonical id (serverless-safe). */
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
  const message: ChatMessage = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    readByUserIds: input.readByUserIds ?? (input.authorRole === "coach" ? [COACH_READER_ID] : []),
  };

  if (!isDemoMode()) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await hydrateForWrite();
      const store = readStore();
      if (!store.messages.some((m) => m.id === message.id)) {
        store.messages.push(message);
        touchThread(store, input.threadId);
      }
      await addCoachChatMessageToDb(message);
      setMemory(store);

      if (await coachChatMessageExistsInDb(message.id)) {
        return message;
      }

      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }

    throw new Error("Chat message could not be saved — retry in a moment.");
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await hydrateForWrite();
    const store = readStore();
    if (!store.messages.some((m) => m.id === message.id)) {
      store.messages.push(message);
      touchThread(store, input.threadId);
    }
    await persistStore(store, "Chat message");

    await hydrateCoachChat({ preferFresh: Boolean(BLOB_TOKEN) });
    if (readStore().messages.some((m) => m.id === message.id)) {
      return message;
    }

    await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
  }

  throw new Error("Chat message could not be saved to cloud storage — retry in a moment.");
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

  if (!isDemoMode()) {
    await updateCoachChatMessageInDb(message);
    setMemory(store);
    return message;
  }

  await persistStore(store, "Chat reaction");
  return message;
}

export async function markThreadRead(threadId: string, readerId: string) {
  if (!isDemoMode()) {
    const changed = await markThreadReadInDb(threadId, readerId);
    if (changed) {
      await hydrateCoachChat({ preferFresh: true });
    }
    return;
  }

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
  if (changed) await persistStore(store, "Chat read state");
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

/** Per-thread unread coach messages for a member (tab / body badges). */
export function getUnreadCountsByThreadForMember(
  memberId: string,
  programSlugs: string[] = [],
): Record<string, number> {
  const threads = listThreadsForMember(memberId, programSlugs);
  const threadIds = new Set(threads.map((t) => t.id));
  const counts: Record<string, number> = {};
  for (const m of readStore().messages) {
    if (!threadIds.has(m.threadId)) continue;
    if (m.authorRole !== "coach") continue;
    if (m.readByUserIds.includes(memberId)) continue;
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

/** Coach-facing alert in the member's chat thread (in-app notification). */
export async function postCoachSystemMessage(params: {
  memberId: string;
  body: string;
  sessionDate?: string;
}) {
  const thread = await ensureMemberThread(params.memberId);
  return addChatMessage({
    threadId: thread.id,
    authorRole: "system",
    authorId: "system",
    authorName: "Train Station",
    kind: "system",
    body: params.body,
    sessionDate: params.sessionDate,
    readByUserIds: [],
  });
}

export { COACH_READER_ID };
